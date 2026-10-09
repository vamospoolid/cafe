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

    // Pastikan role MEKANIK tersedia di database jika profil bisnis adalah BENGKEL
    if (businessType === 'BENGKEL') {
      const hasMekanik = rawRoles.some(r => r.name.toUpperCase() === 'MEKANIK');
      if (!hasMekanik) {
        try {
          const seededMekanik = await prisma.role.upsert({
            where: { id: 'role-system-mekanik' },
            update: {
              name: 'MEKANIK',
              description: 'Mekanik / Teknisi Servis',
              isSystem: true
            },
            create: {
              id: 'role-system-mekanik',
              name: 'MEKANIK',
              description: 'Mekanik / Teknisi Servis',
              isSystem: true
            },
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          });
          rawRoles.push(seededMekanik);
        } catch (e) {
          console.error('Failed to auto-upsert role MEKANIK:', e);
        }
      }
    }

    // Filter role sesuai profil vertikal bisnis
    const filteredRoles = rawRoles.filter(r => {
      const roleName = r.name.toUpperCase();
      if (businessType === 'BENGKEL') {
        // Bengkel tidak memiliki dapur / barista / waiter
        return roleName !== 'KITCHEN' && roleName !== 'WAITER';
      }
      if (businessType === 'RETAIL') {
        // Retail tidak memiliki dapur dan mekanik servis
        return roleName !== 'KITCHEN' && roleName !== 'WAITER' && roleName !== 'MEKANIK';
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
      if (newPin.length < 4 || newPin.length > 8) {
        return res.status(400).json({ error: 'PIN harus terdiri dari 4-8 digit angka.' });
      }
      updateData.pin = String(newPin);
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

    // Update PIN juga di TenantMembership
    if (updateData.pin && req.user?.tenantId) {
      await prisma.tenantMembership.updateMany({
        where: { userId, tenantId: req.user.tenantId },
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

    // Cari user yang tergabung dalam membership tenant aktif
    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId },
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
          else if (legacyUpper === 'STAFF') resolvedRole = m.user.mechanicProfile ? 'MEKANIK' : 'STAFF';
          else resolvedRole = legacyUpper;
        }
      } else if (resolvedRole === 'STAFF' && m.user.mechanicProfile) {
        resolvedRole = 'MEKANIK';
      }
      if (!resolvedRole) resolvedRole = 'CASHIER';

      return {
        id: m.user.id,
        name: m.user.name,
        username: m.user.username,
        role: resolvedRole,
        roleId: m.roleId,
        employmentType: m.employmentType || m.user.employmentType || 'FULL_TIME',
        pin: m.pin || m.user.pin,
        status: m.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif',
        permissionKeys,
        permissions: {
          canVoid: permissionKeys.includes('pos.void') || resolvedRole === 'OWNER' || resolvedRole === 'ADMIN',
          canDiscount: permissionKeys.includes('pos.discount') || resolvedRole === 'OWNER' || resolvedRole === 'ADMIN',
          canEditMenu: permissionKeys.includes('products.manage') || resolvedRole === 'OWNER' || resolvedRole === 'ADMIN',
          canViewReports: permissionKeys.includes('reports.view') || resolvedRole === 'OWNER' || resolvedRole === 'ADMIN',
          canManageStaff: permissionKeys.includes('employees.manage') || resolvedRole === 'OWNER' || resolvedRole === 'ADMIN'
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

    const passwordHash = await bcrypt.hash(password || '123456', 10);
    const staffPin = pin || '123456';

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

    // Otomatis inisialisasi MechanicProfile jika role adalah MEKANIK
    const isMechanicRole = (role && role.toUpperCase().includes('MEKANIK')) || 
                           (membership.role?.name && membership.role.name.toUpperCase().includes('MEKANIK'));
    if (isMechanicRole) {
      try {
        await prisma.mechanicProfile.upsert({
          where: { userId: newUser.id },
          update: { tenantId },
          create: {
            tenantId,
            userId: newUser.id,
            commissionType: 'PERCENT',
            commissionRate: 0.20,
            pendingCommission: 0,
            paidCommission: 0
          }
        });
      } catch (e) {
        console.error('Failed to auto-create MechanicProfile for user:', e);
      }
    }

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
      updateUserData.pin = pin;
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

    // Otomatis pastikan MechanicProfile jika user diubah ke role MEKANIK
    const isNowMechanic = (role && role.toUpperCase().includes('MEKANIK')) || 
                          (updatedUser.role && updatedUser.role.toUpperCase().includes('MEKANIK'));
    if (isNowMechanic) {
      try {
        await prisma.mechanicProfile.upsert({
          where: { userId: Number(id) },
          update: { tenantId },
          create: {
            tenantId,
            userId: Number(id),
            commissionType: 'PERCENT',
            commissionRate: 0.20,
            pendingCommission: 0,
            paidCommission: 0
          }
        });
      } catch (e) {
        console.error('Failed to sync MechanicProfile on user update:', e);
      }
    }

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

// DELETE /api/users/:id - Nonaktifkan staf dari tenant (Soft delete)
router.delete('/:id', authenticateToken, requirePermission('employees.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { id } = req.params;

    // USR-003: Strict membership validation
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

    const targetUser = targetMembership?.user;
    if (!targetUser) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (targetUser.id === req.user?.id) {
      return res.status(400).json({ error: 'Tidak dapat menonaktifkan akun sendiri.' });
    }

    // Suspend membership di tenant ini
    await prisma.tenantMembership.updateMany({
      where: { userId: Number(id), tenantId },
      data: { status: 'SUSPENDED' }
    });

    // Audit Log: User Suspend
    await AuditLogger.log({
      tenantId,
      action: 'USER_SUSPEND',
      resource: 'USER',
      resourceId: String(id),
      description: `Menonaktifkan akses staf "${targetUser.name}" (@${targetUser.username}).`,
      oldValue: { status: 'ACTIVE' },
      newValue: { status: 'SUSPENDED' },
      severity: 'WARNING'
    }, req);

    res.json({ message: 'Status karyawan berhasil dinonaktifkan dari outlet ini.' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Gagal menonaktifkan akun karyawan' });
  }
});

export default router;
