/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

import { configureWeb } from '@adobedjangir/commerce-admin-management/web'
import MyAccess from './MyAccess'
import AccessManagement from './AccessManagement'
import RoleBadge from './RoleBadge'
import { useUserRole } from './useUserRole'

export default function registerImsAccess () {
  configureWeb({
    actionKeys: {
      imsUserProfile: 'ImsAccess/ims-user-profile',
      accessList: 'ImsAccess/access-list',
      accessSave: 'ImsAccess/access-save',
      accessDelete: 'ImsAccess/access-delete'
    },
    extraNav: [
      {
        id: 'my-access',
        path: '/my-access',
        label: 'My Access',
        icon: 'User',
        parentId: 'system'
      },
      {
        id: 'access-management',
        path: '/access-management',
        label: 'Access Management',
        icon: 'UsersLock',
        parentId: 'system'
      }
    ],
    extraPages: {
      'my-access': MyAccess,
      'access-management': AccessManagement
    },
    // Core's SystemConfig + MainPage read these from the registry. Without
    // the ims-access add-on they default to "everyone is admin" / no badge.
    userRoleProvider: useUserRole,
    roleBadge: RoleBadge
  })
}

// Re-exports so consumers can use the hook + badge directly (e.g. embed
// the role pill in their own custom nav).
export { useUserRole, hasRole, ROLE_RANK } from './useUserRole'
export { default as RoleBadge } from './RoleBadge'
export { default as MyAccess } from './MyAccess'
export { default as AccessManagement } from './AccessManagement'
