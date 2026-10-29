import prisma from '../db';
import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { authenticateToken, requirePermission, AuthRequest } from '../middlewares/authMiddleware';
import { requireQuota } from '../middlewares/quotaMiddleware';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();

// GET /api/users/roles-permissions - Daftar role dan permission yang tersedia
router.get('/roles-permissions', authenticateToken, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const [tenant, rawRoles, permissions] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { businessType: true }
      }),
      prisma.role.findMany({
        where: {
          OR: [
            { isSystem: true, tenantId: null },
            { tenantId }
          ]
        },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { name: 'asc' }]
      })
    ]);

    const businessType = tenant?.businessType || 'CAFE';

    // Filter role sesuai profil vertikal bisnis
    const filteredRoles = rawRoles.filter(r => {
      const roleName = r.name.toUpperCase();
      if (businessType === 'BENGKEL') {
        // Bengkel tidak memiliki dapur / barista / waiter
        return roleName !== 'KITCHEN' && roleName !== 'WAITER' && roleName !== 'WAITERS';
      }
      if (businessType === 'RETAIL') {
        // Retail tidak memiliki dapur dan mekanik servis
        return roleName !== 'KITCHEN' && roleName !== 'WAITER' && roleName !== 'WAITERS' && roleName !== 'MEKANIK';
      }
      // Kafe / Resto tidak memiliki mekanik
      return roleName !== 'MEKANIK';
    });

    const formattedRoles = filteredRoles.map(r => {
      const roleName = r.name.toUpperCase();
      let customDesc = r.description;

      // Adaptasi deskripsi per vertikal
      if (businessType === 'BENGKEL') {
        if (roleName === 'OWNER') customDesc = 'Pemilik Bengkel';
        else if (roleName === 'ADMIN') customDesc = 'Admin Operasional Bengkel';
        else if (roleName === 'MANAGER') customDesc = 'Kepala Bengkel / Service Advisor';
        else if (roleName === 'CASHIER') customDesc = 'Kasir Front Desk Bengkel';
        else if (roleName === 'MEKANIK') customDesc = 'Mekanik / Teknisi Servis';
        else if (roleName === 'WAREHOUSE') customDesc = 'Kepala Gudang Sparepart / Partman';
        else if (roleName === 'HR') customDesc = 'Personalia Bengkel';
      } else if (businessType === 'RETAIL') {
        if (roleName === 'OWNER') customDesc = 'Pemilik Toko';
        else if (roleName === 'ADMIN') customDesc = 'Admin Toko';
        else if (roleName === 'MANAGER') customDesc = 'Manager Toko';
        else if (roleName === 'CASHIER') customDesc = 'Kasir Toko';
        else if (roleName === 'WAREHOUSE') customDesc = 'Staf Gudang & Logistik';
        else if (roleName === 'HR') customDesc = 'Personalia';
      } else {
        // Profile F&B / CAFE / RESTO
        if (roleName === 'WAITERS' || roleName === 'WAITER') {
          customDesc = 'Pramusaji / Waiters - Melayani pesanan meja & customer';
        }
      }

      return {
        id: r.id,
        name: r.name,
        description: customDesc,
        isSystem: r.isSystem,
        permissions: r.permissions.map(p => p.permission.key)
      };
    });

    res.json({
      roles: formattedRoles,
      permissions
    });
  } catch (error) {
    console.error('Error fetching roles and permissions:', error);
    res.status(500).json({ error: 'Gagal mengambil data role dan izin' });
  }
});

// GET /api/users/me - Profil akun aktif saat ini
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        employmentType: true,
        pin: true,
        status: true,
        permissions: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    res.json({
      ...user,
      tenantId: req.user?.tenantId,
      role: req.user?.role,
      permissions: req.user?.permissions
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Gagal mengambil profil akun' });
  }
});

// PUT /api/users/me/security - Update password / PIN akun sendiri
router.put('/me/security', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { oldPin, newPin, oldPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    const updateData: any = {};

    // Update PIN
    if (newPin) {
      const cleanNewPin = String(newPin).trim();
      if (cleanNewPin.length < 4 || cleanNewPin.length > 8) {
        return res.status(400).json({ error: 'PIN harus terdiri dari 4-8 digit angka.' });
      }

      // Validasi: Cegah duplikasi PIN dengan staf aktif lain di tenant yang sama
      const tenantId = req.user?.tenantId || user.tenantId;
      if (tenantId) {
        const duplicatePinUser = await prisma.user.findFirst({
          where: {
            id: { not: userId },
            status: 'Aktif',
            pin: cleanNewPin,
            OR: [
              { tenantId },
              { memberships: { some: { tenantId, status: 'ACTIVE' } } }
            ]
          }
        });

        if (duplicatePinUser) {
          return res.status(409).json({
            error: `PIN ${cleanNewPin} sudah digunakan oleh staf lain (${duplicatePinUser.name}). Harap gunakan kombinasi PIN berbeda agar tidak terjadi tabrakan absensi.`,
            code: 'DUPLICATE_PIN'
          });
        }
      }

      updateData.pin = cleanNewPin;
    }

    // Update Password
    if (newPassword) {
      if (newPassword.length < 4) {
        return res.status(400).json({ error: 'Password baru minimal 4 karakter.' });
      }
      if (oldPassword) {
        const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isMatch && user.pin !== oldPassword) {
          return res.status(400).json({ error: 'Password lama tidak cocok.' });
        }
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Tidak ada data keamanan yang diubah.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, username: true, role: true, employmentType: true, pin: true }
    });

    // Update PIN juga di seluruh TenantMembership milik user
    if (updateData.pin) {
      await prisma.tenantMembership.updateMany({
        where: { userId },
        data: { pin: updateData.pin }
      });
    }

    res.json({ message: 'Keamanan akun berhasil diperbarui', user: updated });
  } catch (error) {
    console.error('Update security error:', error);
    res.status(500).json({ error: 'Gagal memperbarui keamanan akun' });
  }
});

// PUT /api/users/me/profile - Update nama profil sendiri
router.put('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama tidak boleh kosong' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: { id: true, name: true, username: true, role: true, employmentType: true, pin: true }
    });

    res.json({ message: 'Profil berhasil diperbarui', user: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Gagal memperbarui profil' });
  }
});

// GET /api/users - Daftar seluruh staf dalam tenant aktif
router.get('/', authenticateToken, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    // Cari user yang tergabung dalam membership tenant aktif (abaikan yang DELETED)
    const memberships = await prisma.tenantMembership.findMany({
      where: {
        tenantId,
        status: { not: 'DELETED' },
        user: {
          tenantId,
          status: { not: 'DELETED' }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            employmentType: true,
            pin: true,
            status: true,
            permissions: true,
            createdAt: true,
            mechanicProfile: true
          }
        },
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      },
      orderBy: { user: { name: 'asc' } }
    });

    const mappedUsers = memberships.map(m => {
      const permissionKeys = m.role?.permissions.map(p => p.permission.key) || [];
      
      // Deteksi role secara akurat
      let resolvedRole = m.role?.name;
      if (!resolvedRole || resolvedRole === 'CASHIER') {
        if (m.user.mechanicProfile) {
          resolvedRole = 'MEKANIK';
        } else if (m.user.role) {
          const legacyUpper = m.user.role.toUpperCase();
          if (legacyUpper === 'ADMIN') resolvedRole = 'ADMIN';
          else if (legacyUpper === 'OWNER') resolvedRole = 'OWNER';
          else if (legacyUpper === 'KASIR' || legacyUpper === 'CASHIER') resolvedRole = 'CASHIER';
          else if (legacyUpper === 'WAITER' || legacyUpper === 'WAITERS') resolvedRole = 'WAITERS';
          else if (legacyUpper === 'STAFF') resolvedRole = m.user.mechanicProfile ? 'MEKANIK' : 'STAFF';
          else resolvedRole = legacyUpper;
        }
      } else if (resolvedRole === 'STAFF' && m.user.mechanicProfile) {
        resolvedRole = 'MEKANIK';
      }
      if (!resolvedRole) resolvedRole = 'CASHIER';

      // Parse custom special permissions dari user record
      let customPerms: any = {};
      try {
        if (m.user.permissions) {
          customPerms = typeof m.user.permissions === 'string' ? JSON.parse(m.user.permissions) : m.user.permissions;
        }
      } catch (_) {}

      const isPrivileged = resolvedRole === 'OWNER' || resolvedRole === 'ADMIN' || resolvedRole === 'SUPERADMIN';
      const canVoid = isPrivileged || (customPerms.canVoid !== undefined ? Boolean(customPerms.canVoid) : permissionKeys.includes('pos.void'));
      const canDiscount = isPrivileged || (customPerms.canDiscount !== undefined ? Boolean(customPerms.canDiscount) : permissionKeys.includes('pos.discount'));
      const canEditMenu = isPrivileged || (customPerms.canEditMenu !== undefined ? Boolean(customPerms.canEditMenu) : permissionKeys.includes('products.manage'));
      const canViewReports = isPrivileged || (customPerms.canViewReports !== undefined ? Boolean(customPerms.canViewReports) : permissionKeys.includes('reports.view'));
      const canManageStaff = isPrivileged || (customPerms.canManageStaff !== undefined ? Boolean(customPerms.canManageStaff) : permissionKeys.includes('employees.manage'));

      let effectivePermissionKeys = [...permissionKeys];
      if (canVoid) {
        if (!effectivePermissionKeys.includes('pos.void')) effectivePermissionKeys.push('pos.void');
      } else {
        effectivePermissionKeys = effectivePermissionKeys.filter(k => k !== 'pos.void');
      }

      if (canDiscount) {
        if (!effectivePermissionKeys.includes('pos.discount')) effectivePermissionKeys.push('pos.discount');
      } else {
        effectivePermissionKeys = effectivePermissionKeys.filter(k => k !== 'pos.discount');
      }

      if (canEditMenu) {
        if (!effectivePermissionKeys.includes('products.manage')) effectivePermissionKeys.push('products.manage');
      } else {
        effectivePermissionKeys = effectivePermissionKeys.filter(k => k !== 'products.manage');
      }

      if (canViewReports) {
        if (!effectivePermissionKeys.includes('reports.view')) effectivePermissionKeys.push('reports.view');
      } else {
        effectivePermissionKeys = effectivePermissionKeys.filter(k => k !== 'reports.view');
      }

      if (canManageStaff) {
        if (!effectivePermissionKeys.includes('employees.manage')) effectivePermissionKeys.push('employees.manage');
      } else {
        effectivePermissionKeys = effectivePermissionKeys.filter(k => k !== 'employees.manage');
      }

      return {
        id: m.user.id,
        name: m.user.name,
        username: m.user.username,
        role: resolvedRole,
        roleId: m.roleId,
        employmentType: m.employmentType || m.user.employmentType || 'FULL_TIME',
        pin: m.pin || m.user.pin,
        status: m.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif',
        permissionKeys: effectivePermissionKeys,
        permissions: {
          canVoid,
          canDiscount,
          canEditMenu,
          canViewReports,
          canManageStaff
        },
        createdAt: m.user.createdAt
      };
    });

    res.json(mappedUsers);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Gagal mengambil data karyawan' });
  }
});

// POST /api/users - Tambah staf baru ke dalam tenant
router.post('/', authenticateToken, requirePermission('employees.manage'), requireQuota('user'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { name, username, password, pin, role, roleId, employmentType, permissions, status } = req.body;

    if (!name || !username) {
      return res.status(400).json({ error: 'Nama dan username wajib diisi' });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // Validasi keunikan username di dalam tenant aktif
    const existingInTenant = await prisma.user.findFirst({
      where: {
        username: cleanUsername,
        OR: [
          { tenantId },
          { memberships: { some: { tenantId } } }
        ]
      }
    });

    if (existingInTenant) {
      return res.status(400).json({ error: `Karyawan dengan username "${cleanUsername}" sudah terdaftar di outlet Anda.` });
    }

    // USR-005: Tentukan Role ID terikat pada role sistem atau tenant aktif
    let targetRoleId = roleId;
    if (!targetRoleId && role) {
      const matchedRole = await prisma.role.findFirst({
        where: {
          OR: [
            { name: role.toUpperCase() },
            { id: `role-system-${role.toLowerCase()}` }
          ],
          AND: [
            {
              OR: [
                { isSystem: true },
                { tenantId }
              ]
            }
          ]
        }
      });
      targetRoleId = matchedRole?.id || 'role-system-cashier';
    }

    let staffPin = pin ? String(pin).trim() : '';
    if (staffPin) {
      // Periksa apakah PIN sudah dipakai oleh staf aktif lain di tenant ini
      const duplicatePinUser = await prisma.user.findFirst({
        where: {
          status: 'Aktif',
          pin: staffPin,
          OR: [
            { tenantId },
            { memberships: { some: { tenantId, status: 'ACTIVE' } } }
          ]
        }
      });
      if (duplicatePinUser) {
        return res.status(400).json({
          error: `PIN ${staffPin} sudah digunakan oleh staf lain (${duplicatePinUser.name}). Harap gunakan PIN 6-digit yang berbeda.`
        });
      }
    } else {
      staffPin = String(Math.floor(100000 + Math.random() * 900000));
    }

    const effectivePassword = password ? String(password).trim() : staffPin;
    const passwordHash = await bcrypt.hash(effectivePassword, 10);

    // Buat user baru terikat pada tenant aktif
    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        username: cleanUsername,
        passwordHash,
        pin: staffPin,
        role: role || 'Kasir',
        tenantId,
        employmentType: employmentType || 'FULL_TIME',
        permissions: JSON.stringify(permissions || {}),
        status: status || 'Aktif'
      }
    });

    // Buat membership untuk tenant aktif
    const membership = await prisma.tenantMembership.create({
      data: {
        userId: newUser.id,
        tenantId,
        roleId: targetRoleId,
        pin: staffPin,
        employmentType: employmentType || 'FULL_TIME',
        status: status === 'Nonaktif' ? 'SUSPENDED' : 'ACTIVE'
      },
      include: {
        role: true
      }
    });

    // Audit Log: User Create
    await AuditLogger.log({
      tenantId,
      action: 'USER_CREATE',
      resource: 'USER',
      resourceId: String(newUser.id),
      description: `Menambahkan staf "${newUser.name}" (@${newUser.username}) dengan role ${membership.role?.name || role}.`,
      newValue: { name: newUser.name, username: newUser.username, role: membership.role?.name || role },
      severity: 'INFO'
    }, req);

    res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      username: newUser.username,
      role: membership.role?.name || role,
      employmentType: membership.employmentType,
      status: membership.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Gagal membuat akun karyawan' });
  }
});

// PUT /api/users/:id - Update data staf & role dalam tenant
router.put('/:id', authenticateToken, requirePermission('employees.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { id } = req.params;
    const { name, username, password, pin, role, roleId, employmentType, permissions, status } = req.body;

    // USR-001: Strict tenant ownership check - pastikan user terdaftar di tenant requester
    const targetMembership = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: Number(id),
          tenantId
        }
      },
      include: { user: true }
    });

    if (!targetMembership && !req.user?.isPlatformAdmin) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan di outlet Anda.' });
    }

    const targetUser = targetMembership ? targetMembership.user : await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!targetUser) return res.status(404).json({ error: 'User tidak ditemukan' });

    // Cegah menurunkan jabatan akun OWNER / Admin utama
    if (targetUser.role === 'Admin' && req.user?.id !== targetUser.id && req.user?.role !== 'OWNER') {
      return res.status(403).json({ error: 'Tidak memiliki izin untuk mengubah data Admin utama.' });
    }

    const updateUserData: any = {};
    if (name) updateUserData.name = String(name).trim();
    if (username) {
      const cleanUsername = String(username).trim().toLowerCase();
      if (cleanUsername !== targetUser.username) {
        const existingUsername = await prisma.user.findFirst({
          where: {
            username: cleanUsername,
            id: { not: targetUser.id },
            OR: [
              { tenantId: req.user?.tenantId },
              { memberships: { some: { tenantId: req.user?.tenantId } } }
            ]
          }
        });
        if (existingUsername) {
          return res.status(400).json({ error: `Username "${cleanUsername}" sudah digunakan oleh staf lain di outlet Anda.` });
        }
        updateUserData.username = cleanUsername;
      }
    }

    if (password) {
      updateUserData.passwordHash = await bcrypt.hash(password, 10);
    }
    if (pin) {
      const cleanPin = String(pin).trim();
      const duplicatePinUser = await prisma.user.findFirst({
        where: {
          id: { not: Number(id) },
          status: 'Aktif',
          pin: cleanPin,
          OR: [
            { tenantId },
            { memberships: { some: { tenantId, status: 'ACTIVE' } } }
          ]
        }
      });
      if (duplicatePinUser) {
        return res.status(400).json({
          error: `PIN ${cleanPin} sudah digunakan oleh staf lain (${duplicatePinUser.name}). Harap gunakan PIN 6-digit yang berbeda.`
        });
      }
      updateUserData.pin = cleanPin;
    }
    if (status) {
      updateUserData.status = status;
    }
    if (role) {
      updateUserData.role = role;
    }
    if (employmentType) {
      updateUserData.employmentType = employmentType;
    }
    if (permissions !== undefined) {
      updateUserData.permissions = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
    }

    const updatedUser = Object.keys(updateUserData).length > 0
      ? await prisma.user.update({
          where: { id: Number(id) },
          data: updateUserData
        })
      : targetUser;

    // USR-005: Update Role & PIN di TenantMembership terikat tenant
    let targetRoleId = roleId;
    if (!targetRoleId && role) {
      const matchedRole = await prisma.role.findFirst({
        where: {
          OR: [
            { name: role.toUpperCase() },
            { id: `role-system-${role.toLowerCase()}` }
          ],
          AND: [
            {
              OR: [
                { isSystem: true },
                { tenantId }
              ]
            }
          ]
        }
      });
      targetRoleId = matchedRole?.id;
    }

    const updateMembershipData: any = {};
    if (targetRoleId) updateMembershipData.roleId = targetRoleId;
    if (pin) updateMembershipData.pin = pin;
    if (employmentType) updateMembershipData.employmentType = employmentType;
    if (status) updateMembershipData.status = status === 'Nonaktif' ? 'SUSPENDED' : 'ACTIVE';

    await prisma.tenantMembership.upsert({
      where: {
        userId_tenantId: {
          userId: Number(id),
          tenantId
        }
      },
      update: updateMembershipData,
      create: {
        userId: Number(id),
        tenantId,
        roleId: targetRoleId || 'role-system-cashier',
        pin: pin || targetUser.pin,
        employmentType: employmentType || 'FULL_TIME',
        status: status === 'Nonaktif' ? 'SUSPENDED' : 'ACTIVE'
      }
    });

    // Audit Log: User Update
    await AuditLogger.log({
      tenantId,
      action: 'USER_UPDATE',
      resource: 'USER',
      resourceId: String(id),
      description: `Mengubah data staf "${updatedUser.name}" (@${updatedUser.username}).`,
      oldValue: { name: targetUser.name, role: targetUser.role, status: targetUser.status },
      newValue: { name: updatedUser.name, role: role || updatedUser.role, status: updatedUser.status },
      severity: 'WARNING'
    }, req);

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      username: updatedUser.username,
      role: role || updatedUser.role,
      employmentType: employmentType || updatedUser.employmentType
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Gagal mengubah data karyawan' });
  }
});

// DELETE /api/users/:id - Hapus akun staf dari tenant (Safe delete & Audit safe)
router.delete('/:id', authenticateToken, requirePermission('employees.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { id } = req.params;
    const numericId = Number(id);

    if (isNaN(numericId)) {
      return res.status(400).json({ error: 'ID karyawan tidak valid' });
    }

    // USR-003: Strict membership validation
    const targetMembership = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: numericId,
          tenantId
        }
      },
      include: { user: true }
    });

    if (!targetMembership && !req.user?.isPlatformAdmin) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan di outlet Anda.' });
    }

    const targetUser = targetMembership?.user;
    if (!targetUser) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (targetUser.id === req.user?.id) {
      return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri yang sedang aktif digunakan.' });
    }

    // Periksa riwayat transaksi / finansial yang terikat dengan foreign key
    const [orderCount, cashCount, attCount, shiftCount, poCount, ingCount, loanCount] = await Promise.all([
      prisma.order.count({ where: { userId: numericId } }),
      prisma.cashFlow.count({ where: { userId: numericId } }),
      prisma.attendance.count({ where: { userId: numericId } }),
      prisma.shift.count({ where: { userId: numericId } }),
      prisma.purchaseOrder.count({ where: { userId: numericId } }),
      prisma.ingredientLog.count({ where: { userId: numericId } }),
      prisma.employeeLoan.count({ where: { userId: numericId } })
    ]);
    const totalTransactions = orderCount + cashCount + attCount + shiftCount + poCount + ingCount + loanCount;

    if (totalTransactions === 0) {
      // 1. Akun bersih tanpa riwayat transaksi: Lakukan Hard Delete sepenuhnya
      await prisma.tenantMembership.deleteMany({
        where: { userId: numericId, tenantId }
      });
      await prisma.userSession.deleteMany({
        where: { userId: numericId }
      });
      const remainingMemberships = await prisma.tenantMembership.count({
        where: { userId: numericId }
      });
      if (remainingMemberships === 0) {
        await prisma.user.delete({
          where: { id: numericId }
        });
      }

      await AuditLogger.log({
        tenantId,
        action: 'USER_DELETE',
        resource: 'USER',
        resourceId: String(numericId),
        description: `Menghapus akun staf "${targetUser.name}" (@${targetUser.username}) secara permanen (tanpa riwayat transaksi).`,
        oldValue: { name: targetUser.name, username: targetUser.username },
        severity: 'WARNING'
      }, req);

      return res.json({
        success: true,
        message: `Akun staf "${targetUser.name}" berhasil dihapus permanen dari sistem.`
      });
    } else {
      // 2. Akun memiliki riwayat transaksi/finansial:
      // Lepaskan membership dari tenant dan lakukan soft-delete + anonymize username
      // agar username asli dapat didaftarkan kembali untuk karyawan baru
      await prisma.tenantMembership.deleteMany({
        where: { userId: numericId, tenantId }
      });
      await prisma.userSession.deleteMany({
        where: { userId: numericId }
      });

      const deletedUsername = `${targetUser.username}__del_${Date.now()}`;
      await prisma.user.update({
        where: { id: numericId },
        data: {
          status: 'DELETED',
          username: deletedUsername
        }
      });

      await AuditLogger.log({
        tenantId,
        action: 'USER_DELETE',
        resource: 'USER',
        resourceId: String(numericId),
        description: `Menghapus staf "${targetUser.name}" (@${targetUser.username}) dari outlet. Riwayat ${totalTransactions} transaksi masa lalu tetap diarsipkan untuk integritas laporan finansial.`,
        oldValue: { name: targetUser.name, username: targetUser.username, status: targetUser.status },
        newValue: { status: 'DELETED', username: deletedUsername },
        severity: 'WARNING'
      }, req);

      return res.json({
        success: true,
        message: `Akun staf "${targetUser.name}" berhasil dihapus dari outlet Anda. Riwayat ${totalTransactions} transaksi masa lalu tetap tersimpan rapi untuk laporan keuangan.`
      });
    }
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Gagal menghapus akun karyawan' });
  }
});

export default router;
