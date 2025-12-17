# Project Zomboid UI Mod Manager

Web application để quản lý server Project Zomboid, bao gồm:
- Quản lý cấu hình server (server settings)
- Quản lý mod từ Steam Workshop
- Thêm/xóa mod
- Tìm kiếm mod trên Steam Workshop

## Cài đặt

### Development

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trong trình duyệt.

### Production với Docker (Khuyến nghị)

Xem [DOCKER.md](./DOCKER.md) để biết hướng dẫn chi tiết.

**Quick start:**

```bash
# Tạo file .env với Steam API key
echo "STEAM_API_KEY=your_steam_api_key_here" > .env

# Chỉnh sửa docker-compose.yml để mount thư mục server của bạn
# Sau đó build và chạy:
docker-compose up -d
```

## Cấu hình

### Development

Tạo file `.env.local` với các biến môi trường:

```
STEAM_API_KEY=your_steam_api_key_here
ZOMBOID_SERVER_PATH=C:\Users\YourName\Zomboid\Server
```

### Production (Docker)

Tạo file `.env` hoặc set environment variables:

```
STEAM_API_KEY=your_steam_api_key_here
```

## Tính năng

- ✅ Quản lý server settings
- ✅ Quản lý mod list
- ✅ Tích hợp Steam Workshop API
- ✅ Tìm kiếm và thêm mod từ Steam Workshop
- ✅ Thêm mod bằng Steam ID, tên mod, hoặc link Workshop
- ✅ Đọc toàn bộ WorkshopItems từ file server
- ✅ Hiển thị hình ảnh và thông tin chi tiết mod

## Deploy lên Host (Không cần Docker)

### Cách Nhanh Nhất

1. **Package ứng dụng:**
```bash
# Windows
package-for-deploy.bat

# Linux/Mac
chmod +x package-for-deploy.sh
./package-for-deploy.sh
```

2. **Upload thư mục `deploy-package/` lên host**

3. **Trên host:**
```bash
# Tạo file .env
nano .env
# (Nhập STEAM_API_KEY và các biến khác)

# Cài đặt và chạy
npm install --production
npm start
```

Xem file [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) để biết hướng dẫn chi tiết và đơn giản nhất.

Xem file [DEPLOY.md](./DEPLOY.md) để biết hướng dẫn nâng cao về:
- Sử dụng PM2 để quản lý process
- Cấu hình Nginx reverse proxy
- Deploy lên shared hosting

## Docker Deployment

Xem file [DOCKER.md](./DOCKER.md) để biết hướng dẫn chi tiết về:
- Build và chạy với Docker
- Cấu hình volumes
- Production deployment
- Troubleshooting

