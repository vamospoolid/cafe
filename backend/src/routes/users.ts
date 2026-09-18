import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { authenticateToken, requirePermission, AuthRequest } from '../middlewares/authMiddleware';
import { requireQuota } from '../middlewares/quotaMiddleware';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();
const prisma = new PrismaClient();

// GET /api/users/roles-permissions - Daftar role dan permission yang tersedia
router.get('/roles-permissions', authenticateToken, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-default-muki';

    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({
        where: {
          OR: [
            { isSystem: true },
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

    const formattedRoles = roles.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map(p => p.permission.key)
    }));

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
    const tenantId = req.user?.tenantId || 'tenant-default-muki';

    // Cari user yang tergabung dalam membership tenant aktif
    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            pin: true,
            status: true,
            createdAt: true
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
      return {
        id: m.user.id,
        name: m.user.name,
        username: m.user.username,
        role: m.role?.name || 'CASHIER',
        roleId: m.roleId,
        employmentType: m.employmentType,
        pin: m.pin || m.user.pin,
        status: m.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif',
        permissionKeys,
        permissions: {
          canVoid: permissionKeys.includes('pos.void') || m.role?.name === 'OWNER',
          canDiscount: permissionKeys.includes('pos.discount') || m.role?.name === 'OWNER',
          canEditMenu: permissionKeys.includes('products.manage') || m.role?.name === 'OWNER',
          canViewReports: permissionKeys.includes('reports.view') || m.role?.name === 'OWNER',
          canManageStaff: permissionKeys.includes('employees.manage') || m.role?.name === 'OWNER'
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
    const tenantId = req.user?.tenantId || 'tenant-default-muki';
    const { name, username, password, pin, role, roleId, employmentType, permissions, status } = req.body;

    if (!name || !username) {
      return res.status(400).json({ error: 'Nama dan username wajib diisi' });
    }

    let existingUser = await prisma.user.findUnique({ where: { username } });

    // Tentukan Role ID
    let targetRoleId = roleId;
    if (!targetRoleId && role) {
      const matchedRole = await prisma.role.findFirst({
        where: {
          OR: [
            { name: role.toUpperCase() },
            { id: `role-system-${role.toLowerCase()}` }
          ]
        }
      });
      targetRoleId = matchedRole?.id || 'role-system-cashier';
    }

    const passwordHash = await bcrypt.hash(password || '123456', 10);
    const staffPin = pin || '123456';

    let userToLink;
    if (existingUser) {
      // User sudah ada, cek apakah sudah jadi member di tenant ini
      const existingMembership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId: existingUser.id,
            tenantId
          }
        }
      });

      if (existingMembership) {
        return res.status(400).json({ error: 'Karyawan dengan username ini sudah terdaftar di outlet Anda.' });
      }

      userToLink = existingUser;
    } else {
      // Buat user baru
      userToLink = await prisma.user.create({
        data: {
          name,
          username,
          passwordHash,
          pin: staffPin,
          role: role || 'Kasir',
          employmentType: employmentType || 'FULL_TIME',
          permissions: JSON.stringify(permissions || {}),
          status: status || 'Aktif'
        }
      });
    }

    // Buat membership untuk tenant aktif
    const membership = await prisma.tenantMembership.create({
      data: {
        userId: userToLink.id,
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
      resourceId: String(userToLink.id),
      description: `Menambahkan staf "${userToLink.name}" (@${userToLink.username}) dengan role ${membership.role?.name || role}.`,
      newValue: { name: userToLink.name, username: userToLink.username, role: membership.role?.name || role },
      severity: 'INFO'
    }, req);

    res.status(201).json({
      id: userToLink.id,
      name: userToLink.name,
      username: userToLink.username,
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
    const tenantId = req.user?.tenantId || 'tenant-default-muki';
    const { id } = req.params;
    const { name, username, password, pin, role, roleId, employmentType, permissions, status } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!targetUser) return res.status(404).json({ error: 'User tidak ditemukan' });

    // Cegah menurunkan jabatan akun OWNER / Admin utama
    if (targetUser.role === 'Admin' && req.user?.id !== targetUser.id && req.user?.role !== 'OWNER') {
      return res.status(403).json({ error: 'Tidak memiliki izin untuk mengubah data Admin utama.' });
    }

    const updateUserData: any = {
      name,
      username
    };

    if (password) {
      updateUserData.passwordHash = await bcrypt.hash(password, 10);
    }
    if (pin) {
      updateUserData.pin = pin;
    }
    if (status) {
      updateUserData.status = status;
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: updateUserData
    });

    // Update Role & PIN di TenantMembership
    let targetRoleId = roleId;
    if (!targetRoleId && role) {
      const matchedRole = await prisma.role.findFirst({
        where: {
          OR: [
            { name: role.toUpperCase() },
            { id: `role-system-${role.toLowerCase()}` }
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

// DELETE /api/users/:id - Nonaktifkan staf dari tenant (Soft delete)
router.delete('/:id', authenticateToken, requirePermission('employees.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-default-muki';
    const { id } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id: Number(id) } });
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
