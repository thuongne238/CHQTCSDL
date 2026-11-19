# FlightLab — bản web riêng để test nghiệp vụ PostgreSQL

Mở **http://localhost:3001** sau khi khởi động. Đây là bản web mới dành cho test, có frontend và API Express riêng, dùng PostgreSQL nhúng PGlite. Không cần Oracle, không cần DBeaver và không kết nối cổng 5433. Bản Oracle trong `flight-booking-app` vẫn ở riêng.

## Chạy ngay

Trong PowerShell:

```powershell
cd E:\Downloads\DoAn\flight-booking-test-web
npm start
```

Giữ cửa sổ này đang chạy; Ctrl+C để dừng. Nếu chép thư mục sang máy mới, cài Node.js 24+ và chạy `npm ci` trước. Schema và dữ liệu được tạo tự động ở lần mở đầu, từ `database.sql` có sẵn trong thư mục này. Không phải chạy thêm script SQL bằng tay.

Để chạy nền trên Windows, từ thư mục gốc dự án:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File flight-booking-test-web/Start-Web.ps1
```

Dừng bản chạy nền:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File flight-booking-test-web/Stop-Web.ps1
```

Cổng mặc định 3001. Nếu cần đổi: `$env:PORT='3002'; npm start`. Log bản chạy nền nằm trong `runtime/server.log` và `runtime/server-error.log`; thông tin tiến trình ở `runtime/web.json`.

## Tài khoản demo

| Quyền | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Quản trị | `admin` | `admin123` |
| Khách hàng | `nguyenvanan` | `user123` |
| Khách hàng | `tranthibinh` | `user123` |

Nút demo trên màn hình đăng nhập thực hiện xác thực bằng mật khẩu thật. Không có chế độ báo thành công giả khi CSDL lỗi. Đăng ký mới chỉ được quyền USER, kể cả gửi thêm role ADMIN vào request.

## Test luồng đặt vé

1. Đăng nhập bằng admin hoặc khách hàng.
2. Ở **Chuyến bay**, lọc điểm đi/đến hoặc chọn một chuyến bất kỳ.
3. Chọn ghế còn trống. Đổi **Cách giữ ghế** nếu muốn thử PESSIMISTIC, OPTIMISTIC hoặc tự cấp ghế phổ thông.
4. Nhấn **Giữ ghế trong 10 phút**. CSDL tạo reservation, trạng thái ghế chuyển HOLD và version tăng. Chưa tạo vé/payment ở bước này.
5. Nhấn **Thanh toán & xuất vé**. Vé mới xuất hiện ở **Vé của tôi**; chỉ một payment và một ticket được ghi nhận.
6. Chọn lại cùng ghế để kiểm tra ghế đã bán không còn đặt được. Nếu gửi API lặp checkout, nhận P2004 thay vì xuất vé thứ hai.

Khóa lạc quan lấy version từ API ghế; phiên bản cũ bị từ chối. Tự cấp ghế dùng `FOR UPDATE SKIP LOCKED` và trả đúng ghế đã chọn trong CSDL. Lưu ý giới hạn một backend bên dưới: web này không chứng minh các session thực sự tranh khóa đồng thời.

## Test giữ chỗ hết hạn

Giữ một ghế nhưng chưa thanh toán, rồi nhấn **Giả lập hết hạn** ở sơ đồ ghế hoặc trang **Giữ chỗ của tôi**. API kiểm tra quyền sở hữu, đặt hạn về quá khứ và gọi hàm giải phóng trong một giao dịch. Ghế trở lại AVAILABLE, reservation thành EXPIRED, version tăng. Checkout reservation cũ phải bị từ chối.

Ngoài nút mô phỏng, worker chạy mỗi 15 giây khi web đang mở để dọn các giữ chỗ hết hạn tự nhiên. Checkout vẫn tự kiểm tra hạn ngay cả khi worker chưa chạy. Dữ liệu ghế trên màn hình có thể cũ; dùng **Tải lại** để lấy trạng thái mới.

## Test flash sale

Vào **Flash sale**, chọn một ưu đãi, chọn ghế và giữ chỗ. Khi thanh toán, API gửi đúng item ID; SQL kiểm tra lịch bay, giờ mở/đóng và hạn ngạch. Quota chỉ giảm khi checkout thành công. Nếu hết suất, giao dịch checkout bị từ chối và giữ chỗ trước đó vẫn còn, có thể thanh toán giá thường tại **Giữ chỗ của tôi** hoặc giả lập hết hạn.

Giá luôn tính trong CSDL; không tin giá client gửi lên. Một item sale áp dụng cho ghế thuộc lịch bay đó, không phân biệt hạng ghế. Không có thu tiền ngân hàng thật.

## Phòng kiểm thử — tài khoản admin

- **Chạy 12 kịch bản**: thực thi nguyên schema/seed/test trên một PostgreSQL tạm trong RAM. Không xóa hoặc sửa dữ liệu web đang dùng. Không phải chỉ tô PASS dựa vào mã frontend.
- **Toàn vẹn CSDL web**: đọc trực tiếp 8 bộ đếm bất thường của CSDL đang dùng. Tất cả cần bằng 0 sau thao tác thành công hoặc bị từ chối.
- **Execution plan**: 2 truy vấn trước/sau, SELECT thực thi thật với `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`. Baseline tắt index scan cục bộ; dữ liệu nhỏ có thể không nhanh hơn sau index.
- **Lịch sử thao tác**: HTTP status, SQLSTATE, request ID và thời gian của các request ghi dữ liệu thuộc tài khoản hiện tại; có thể tải JSON. Log này giữ tối đa 100 mục trong bộ nhớ, không ghi mật khẩu.

12 ca gồm: atomic checkout/audit; CAS/version; chủ sở hữu và giá; expiry; quota cuối và giá 0; sale chưa mở/đã đóng; chuyến đã khởi hành; capacity/FK; ticket unique và chống mở lại ghế đã bán; rollback khi user sai; tự cấp ghế; sale sai lịch và dữ liệu âm.

## Kiểm chứng tự động

```powershell
npm test
npm run test:browser
```

`npm test` có 14 test API tích hợp trên PostgreSQL thật nhúng trong RAM: login/session, quyền admin, đăng ký, input/Origin, lọc chuyến, hold/checkout, owner, expiry/version, auto allocation, quota/giá 0, sale sai lịch, toàn vẹn, chạy test độc lập và logout. Không đụng dữ liệu demo được lưu trên đĩa.

`test:browser` dùng Playwright với Chrome/Brave/Edge cài sẵn trên Windows, hoặc đường dẫn qua `BROWSER_EXECUTABLE`. Chạy trên CSDL tạm, kiểm tra giao diện desktop/mobile, tạo tài khoản và đi qua các luồng giữ ghế, xuất vé, expiry, phân quyền và phòng test. Screenshot và kết quả ở `test-results/`.

## Dữ liệu và giới hạn

- Dữ liệu riêng nằm trong `flight-booking-test-web/data`. Khởi động lại giữ các vé và user bạn đã tạo. Không chạy đồng thời hai tiến trình web trên cùng thư mục data.
- Cookie đăng nhập HttpOnly/SameSite, lưu phiên trong RAM; khởi động lại web thì cần đăng nhập lại. Origin khác bị từ chối với thao tác ghi từ trình duyệt.
- Ứng dụng chỉ lắng nghe `127.0.0.1`, dành cho test trên máy. Asset HTML/CSS/JS/SVG có sẵn, không phụ thuộc CDN.
- PGlite có một backend, các lời gọi được xếp hàng. Không dùng bản này để kết luận đã kiểm thử 100/1.000 người đặt vé song song, NOWAIT giữa hai session hoặc isolation đa session. Các bài test đó cần PostgreSQL server thật hoặc bản Oracle đúng yêu cầu PDF.
- Chưa có hủy/hoàn tiền, cổng thanh toán thật, quản lý lịch bay và máy bay qua CRUD UI. Các trigger, ràng buộc capacity và trường hợp lỗi vẫn được thực thi trong 12 kịch bản SQL.
- CSDL web riêng với CSDL DBeaver ở `postgres-test/data`; thay đổi ở hai bản không tự đồng bộ. Tách riêng để kết nối DBeaver không làm treo web test.
- Bản PostgreSQL dùng để thử nghiệp vụ theo yêu cầu; không thay thế yêu cầu Oracle 23ai trong bài nộp.
