// 用户
export interface UserOut {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  status: string;
  email_verified: boolean;
  department_id: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface UserCreate {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  department_id?: string | null;
}

export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  department_id?: string | null;
  status?: string;
}

export interface UserListOut {
  items: UserOut[];
  total: number;
  page: number;
  size: number;
}

// 部门
export interface DepartmentOut {
  id: string;
  node_seq: number;
  name: string;
  code: string;
  parent_id: string | null;
  level: number;
  path: string;
  sort_order: number;
  manager_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DepartmentTreeNode extends DepartmentOut {
  children: DepartmentTreeNode[];
}

export interface DepartmentCreate {
  name: string;
  code: string;
  parent_id?: string | null;
  sort_order?: number;
  manager_id?: string | null;
}

export interface DepartmentUpdate {
  name?: string;
  code?: string;
  sort_order?: number;
  manager_id?: string | null;
  status?: string;
}

export interface DepartmentListOut {
  items: DepartmentOut[];
  total: number;
  page: number;
  size: number;
}

// 角色
export interface RoleOut {
  id: string;
  name: string;
  code: string;
  description: string | null;
  data_scope: string;
  status: string;
  permissions: PermissionOut[];
}

export interface RoleCreate {
  name: string;
  code: string;
  description?: string;
  permission_ids?: string[];
}

export interface RoleUpdate {
  name?: string;
  code?: string;
  description?: string;
  permission_ids?: string[];
  data_scope?: string;
  status?: string;
}

// 权限
export interface PermissionOut {
  id: string;
  name: string;
  code: string;
  type: string;
  resource: string;
  action: string | null;
}

// 系统配置
export interface ConfigGroup {
  group: string;
  values: Record<string, unknown>;
}

export interface ConfigValueUpdate {
  value: string | number | boolean | Record<string, unknown>;
}

// 分页
export interface PaginationMeta {
  page: number;
  size: number;
  total: number;
}
