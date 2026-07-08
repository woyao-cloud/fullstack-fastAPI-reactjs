// k6 登录压力测试
// 运行: k6 run tests/performance/k6-login.js
// 选项: k6 run --vus 100 --duration 30s tests/performance/k6-login.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// 测试配置
export const options = {
  stages: [
    { duration: '10s', target: 50 },   // 爬升到 50 VU
    { duration: '30s', target: 100 },  // 保持 100 VU
    { duration: '10s', target: 0 },    // 降级到 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],  // P95 < 200ms, P99 < 500ms
    http_req_failed: ['rate<0.01'],                  // 失败率 < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000/api/v1';

// 预生成测试用户
const USERS = Array.from({ length: 100 }, (_, i) => ({
  email: `stress${i}@test.com`,
  password: 'StressPass123!',
}));

export default function () {
  const user = USERS[Math.floor(Math.random() * USERS.length)];

  // 1. 登录
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login has access_token': (r) => r.json('access_token') !== '',
  });

  if (loginRes.status === 200) {
    const token = loginRes.json('access_token');

    // 2. 获取当前用户
    const meRes = http.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check(meRes, { 'me status 200': (r) => r.status === 200 });

    // 3. 获取用户列表
    const usersRes = http.get(`${BASE_URL}/users?page=1&size=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check(usersRes, { 'users list status 200': (r) => r.status === 200 });

    // 4. 获取部门树
    const deptRes = http.get(`${BASE_URL}/departments/tree`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check(deptRes, { 'dept tree status 200': (r) => r.status === 200 });
  }

  sleep(1);
}

// 设置函数（可选：用于创建测试数据）
export function setup() {
  // 尝试注册测试用户（幂等）
  for (const user of USERS) {
    http.post(`${BASE_URL}/auth/register`, JSON.stringify({
      email: user.email,
      password: user.password,
      first_name: 'Stress',
      last_name: 'Test',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return { users: USERS.length };
}
