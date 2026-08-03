import { createClient } from '@libsql/client';
const client = createClient({
  url: 'libsql://shouye-celestial-taurus-tj5dhy.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODU3NDA0MTYsImlkIjoiMDE5ZmMyZmMtOGUwMS03NzY1LTk3MTItYWI1NzBhMjQ3NzM3Iiwia2lkIjoibGpsTnFLanlZTWxTeGtxZlc4S0lEM2sxa09Od0h0Yzd5bVlqSGl2TW5iayIsInJpZCI6ImQyYzE5ODc2LWM5YTktNGM5NC1iNTZkLTY0MDNhNjAwNDAxOCJ9.zmZfSsqsa32Zkduq2lu7NCc64b-bzWtbzSii5Qg1TTH_XJA4ynlI6E8nEKpu6EhlggbxW1EYLaMQzMNQG1UnDg',
});

// 查看最新发布的帖子
const posts = await client.execute("SELECT id, title, createdAt FROM Post ORDER BY createdAt DESC LIMIT 3");
console.log('最新帖子:');
for (const row of posts.rows) {
  console.log(`  ID: ${row[0]}, 标题: ${row[1]}, 时间: ${row[2]}`);
}

// 查看用户
const users = await client.execute("SELECT username, role FROM User");
console.log('\n用户:');
for (const row of users.rows) {
  console.log(`  ${row[0]} (${row[1]})`);
}
