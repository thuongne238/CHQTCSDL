# Kết quả kiểm tra đề 23

Đối chiếu PDF `Nganh HTTT_ CNPM DBMS_25_De_Tai_Do_An_Cuoi_Ky.pdf`, trang 5–8: đề 23 là **đặt vé máy bay trực tuyến kèm flash sale**, trọng tâm Transactions & Concurrency Control, Isolation Levels, Locking. Không phải đề 24 về tối ưu truy vấn, nhưng mục 3.1 vẫn yêu cầu mọi đề tài phân tích ít nhất hai truy vấn và chuẩn bị ít nhất năm kịch bản kiểm thử.

**Kết luận:** bản ban đầu chưa đáp ứng đầy đủ phần lõi đề 23. Đã sửa và bổ sung mã nguồn dưới đây. Chưa thể xác nhận đạt toàn bộ yêu cầu nộp/bảo vệ vì Oracle cấu hình tại `localhost:1522/FREEPDB1` từ chối kết nối; chưa có kết quả biên dịch/thực thi PL/SQL, execution plan, số đo tải thật và demo giao diện kết nối Oracle.

## Các lỗi phát hiện và xử lý

| Mức độ | Vấn đề bản ban đầu | Thay đổi |
|---|---|---|
| Nghiêm trọng | Thanh toán chỉ kiểm tra status, bỏ qua `hold_expires_at` | Checkout kiểm tra thời hạn, chủ sở hữu và trạng thái ghế sau khi khóa |
| Nghiêm trọng | API commit giữ ghế trước thanh toán; truy vấn “reservation mới nhất” có thể lấy nhầm khi cùng user đặt song song | OUT bind trả chính xác reservation; một commit sau toàn bộ luồng, rollback khi lỗi |
| Nghiêm trọng | `sold_count` không được cập nhật trong giao dịch; flash sale chỉ hiển thị | Truyền item ID từ giao diện, xác minh lịch/thời gian/trạng thái, khóa item và tăng quota có điều kiện; giá tính tại DB |
| Nghiêm trọng | Không có UNIQUE trên `tickets.seat_id`; trigger cập nhật trạng thái không chứng minh được chống trùng vé | UNIQUE seat_id là lớp bảo vệ cuối; một active hold cho mỗi ghế qua function-based unique index |
| Nghiêm trọng | Đăng ký gửi role ADMIN được tự cấp quyền | Đăng ký luôn tạo USER; role và user ID xác minh lại trong DB; DB lỗi/tài khoản bị xóa thì từ chối |
| Cao | Tra cứu công khai dùng LIKE và booking ID có thể lộ dữ liệu người khác | Đăng nhập, khớp mã vé chính xác và lọc đúng chủ sở hữu |
| Cao | Job expiry gồm hai UPDATE theo hai snapshot, có thể đụng giao dịch xác nhận | Worker khóa ghế trước, cập nhật reservation và ghế cùng transaction; SKIP LOCKED bỏ dòng đang bận |
| Cao | Chỉ optimistic path tăng version | Trigger tăng version trên mọi cập nhật ghế; optimistic dùng compare-and-swap |
| Cao | File báo cáo có procedure rời ngoài package/CREATE PROCEDURE; quota/capacity minh họa không tích hợp | File báo cáo dùng lại package chung; bỏ trigger đếm tổng toàn hệ thống với sức chứa giả định 100 |
| Cao | `FETCH FIRST ... FOR UPDATE SKIP LOCKED` dùng làm mẫu cấp ghế | Dùng explicit cursor FOR UPDATE SKIP LOCKED, FETCH một dòng rồi CLOSE |
| Cao | Schema thiếu ROLE, NOT NULL ở FK và nhiều CHECK; reservation có thể chỉ nhầm lịch của ghế | Thêm ROLE, CHECK, FK bắt buộc và composite FK `(seat_id,schedule_id)` |
| Cao | Sức chứa chỉ kiểm tra trên booking toàn hệ thống | Compound trigger kiểm tra inventory theo từng lịch bay, khóa schedule/flight/aircraft; chặn giảm capacity quá số ghế và đổi máy bay sau khi tạo inventory |
| Trung bình | Seed xóa dữ liệu cũ và autocommit từng bước | Seed chỉ nhận schema chưa có user; một transaction và rollback khi lỗi, tạo vé mẫu qua package |
| Trung bình | Một số giao diện báo thành công hoặc dùng mock khi API mất kết nối | Các luồng tải/ghi hiện báo lỗi thực tế; quản trị không báo lưu/xóa thành công khi API thất bại |
| Trung bình | Giá 0 bị mất do dùng `||` khi đọc giá/tổng tiền | Dùng nullish fallback cho các giá trị tiền trong giao diện chính |
| Cao | Dữ liệu DB/PNR/tên người dùng có thể được ghép vào HTML hoặc inline handler | Thêm SafeHtml cho các trang chính, escape theo ngữ cảnh HTML và JS; toast/lỗi đăng ký dùng textContent; hai test kiểm tra payload chứa ký tự đặc biệt |

## Đối chiếu yêu cầu PDF sau thay đổi

| Yêu cầu | Tình trạng |
|---|---|
| Oracle 23ai | Driver/cấu hình và bộ cài có kiểm tra phiên bản; chưa kết nối để xác nhận phiên bản thực tế |
| Ít nhất 5 bảng quan hệ | 14 bảng trong script |
| Package/procedure/trigger, exception | Ba package: nghiệp vụ, tên tương thích và diagnostics; package chính có 8 procedure công khai; 7 trigger; có savepoint/rollback/exception. Chưa biên dịch trên DB thật |
| Chống bán trùng ghế | Đã cài đặt khóa, CAS và UNIQUE; cần chạy test Oracle để xác nhận |
| Flash sale đồng thời | Đã cài đặt quota và giao dịch; cần chạy test Oracle để xác nhận |
| Isolation levels | Đã viết test 2 session cho READ COMMITTED và SERIALIZABLE, kiểm tra ORA-08177; chưa có kết quả thực tế |
| Ít nhất 5 kịch bản lõi/biên/lỗi | 16 test service/API/escaping đã đạt; bộ Oracle có 12 kịch bản, bị chặn tại kết nối |
| Ít nhất 2 truy vấn trước/sau tối ưu | Có `sql/execution_plans.sql`, xuất SPOOL; chưa có plan/thời gian đo thật |
| Giao diện → API → Oracle | Đã sửa luồng mã nguồn; chưa demo end-to-end vì Oracle offline |
| Chạy lại từ đầu | Có `npm run db:install`, seed và README; có migration riêng cho schema gốc; cần kiểm chứng cài mới trên Oracle |
| Báo cáo, slide, minh chứng | Chưa thấy báo cáo Word 30–50 trang/slide trong thư mục. File SQL và tài liệu kiểm tra này không thay thế báo cáo theo PDF |

“SPO” trong yêu cầu được triển khai ở phần stored procedure/package; đồng thời bổ sung SPOOL xuất execution plan để thuận tiện đưa minh chứng vào báo cáo.

## Index và giao dịch

Index quan trọng bổ sung: `uq_holding_seat`, UNIQUE ticket/seat, `idx_res_seat_schedule`, `idx_schedule_departure`, `idx_flights_route`, `idx_seat_class_available`, `idx_bookings_history`, `idx_tickets_sale`. Script cài mới bỏ một số index đơn trùng tiền tố của index ghép. Không kết luận tăng tốc khi chưa đo; index tăng chi phí ghi và optimizer có thể chọn full scan trên tập dữ liệu nhỏ.

Các procedure không tự COMMIT. Luồng API commit đúng một lần. Savepoint ở từng thao tác giúp rollback phần thao tác khi gọi PL/SQL và bắt lỗi trong cùng session; service API rollback toàn bộ luồng nếu bước sau thất bại. Chống trùng vé dựa trên ràng buộc UNIQUE cùng khóa ghế, không dựa vào đếm COUNT dưới READ COMMITTED.

Thứ tự khóa nghiệp vụ chính: ghế → reservation → item sale → chiến dịch sale. NOWAIT trả lỗi bận thay vì chờ vô hạn. Cấp ghế tự động và expiry dùng SKIP LOCKED. Optimistic UPDATE có thể chờ khóa do Oracle; callTimeout phía Node giới hạn thời gian chờ lời gọi, khi lỗi service rollback toàn giao dịch.

Mặc định Oracle READ COMMITTED. SERIALIZABLE chỉ được đặt trong test session để minh họa snapshot và lỗi xung đột; không tự động đổi mọi yêu cầu web sang SERIALIZABLE. Giao dịch gặp ORA-08177 cần bắt đầu lại từ đầu, không chỉ chạy lại câu UPDATE trong transaction cũ. Tham khảo chính thức: [Oracle 23 — Transaction Processing and Control](https://docs.oracle.com/en/database/oracle/oracle-database/23/lnpls/transaction-processing-and-control.html).

## Kịch bản Oracle cần chạy

1. Giữ–checkout: đúng một ticket, đúng payment, có audit, version tăng; checkout lặp bị từ chối.
2. Giữ chỗ hết hạn: không thanh toán được, expiry mở lại đúng ghế, không mở lại hold mới.
3. User không tồn tại, sai chủ sở hữu, sai tiền, version cũ: không để lại cập nhật dở dang.
4. Session A giữ khóa ghế; session B NOWAIT báo bận; SKIP LOCKED chọn ghế khác.
5. Vượt capacity, reservation trỏ nhầm lịch: bị từ chối.
6. Chuyến bay đã khởi hành: không giữ ghế, trạng thái ghế giữ nguyên.
7. Chèn vé thứ hai vào cùng ghế, mở lại ghế đã xuất vé, giảm capacity xuống dưới inventory: bị từ chối.
8. Flash sale sai lịch/chưa bắt đầu/hết quota; checkout giá 0 vẫn tạo payment 0 hợp lệ.
9. READ COMMITTED: không thấy dữ liệu chưa commit; SELECT kế tiếp thấy dữ liệu đã commit.
10. SERIALIZABLE: giữ snapshot; UPDATE dữ liệu bị session khác sửa nhận ORA-08177.
11. 100 tác vụ tranh một ghế: đúng một tác vụ commit thành công và một ticket; có thể tăng lên 1.000.
12. Hai ghế tranh quota cuối: đúng một giao dịch thắng, không vượt quota, giao dịch thua không để lại HOLD.

Các test concurrency dùng pool 20 kết nối, không tương đương 1.000 Oracle sessions hay kết quả benchmark HTTP. Cần lưu kết quả chạy, ảnh màn hình, execution plan và cấu hình máy thật khi hoàn thiện báo cáo.

## Giới hạn và việc còn phải xác minh

- Chưa có kết quả runtime PL/SQL. `npm run check` chỉ phân tích JavaScript, test loader chỉ xác nhận tách câu lệnh đúng cấu trúc; không phải compiler Oracle.
- Chưa kiểm thử thao tác trình duyệt thật. Các trang dùng CDN cho Tailwind/jQuery/DevExpress nên demo giao diện còn phụ thuộc mạng.
- Chưa đo độ trễ, throughput, tỷ lệ lỗi và kiểm thử tải HTTP toàn luồng. Các phản hồi NOWAIT bận là một phần thiết kế; client cần tải lại/tranh lại sau.
- Đây là mô hình thanh toán đồng bộ giả lập. Chưa có callback thanh toán, idempotency key cho cổng ngoài, hủy/hoàn tiền, retry queue hoặc vé khứ hồi. Không bật tính năng hủy bằng cách tự sửa BOOKED về AVAILABLE.
- Đã kiểm tra escaping ở các template giao diện chính bằng test riêng; chưa có kiểm thử trình duyệt/security scanner toàn diện, và các file JS giao diện cũ không được trang hiện tại sử dụng vẫn nên được loại bỏ hoặc kiểm toán riêng trước khi công khai.
- Migration giữ dữ liệu lịch sử; quota mẫu cũ và liên kết vé cũ không tự suy diễn. Dùng `verify_invariants.sql` để đối soát trước khi chứng minh tính nhất quán.

Hướng dẫn chạy và file cấu hình mẫu nằm trong `flight-booking-app/README.md`.

Kết quả chạy tại workspace: `npm run check` đạt (24 tệp/script JavaScript); `npm test` đạt 16/16. `npm run test:oracle` dừng ở bước kết nối, báo NJS-503/ECONNREFUSED tại 127.0.0.1:1522. Không coi các kịch bản Oracle là đã đạt.

## Bản SQL độc lập dành cho DBeaver

`DE_TAI_23_DBEAVER.sql` là bản cài mới chạy độc lập bằng Alt+X: không dùng `@@`, `SET`, `WHENEVER` hoặc `SPOOL`, không cần SQL*Plus hay file con trên máy đích. Có 14 bảng nghiệp vụ, 1 bảng lưu diagnostics, 3 package với body, 7 trigger, 1 view đối soát, seed và 10 smoke test tự rollback dữ liệu thử. Package diagnostics còn cho chạy lại 10 ca từ web với fixture riêng. Không gộp migration vào luồng cài mới vì ALTER lại các bảng vừa tạo sẽ gây xung đột.

Các lỗi nhỏ đã xử lý khi đóng gói: dùng biến PL/SQL để lưu SQLERRM trước INSERT; tạo savepoint trước truy vấn khởi tạo test; đóng cursor/giải phóng CLOB an toàn trong nhánh lỗi plan; kiểm tra compilation chỉ đếm ATTRIBUTE=ERROR thay vì coi warning là lỗi. File có hash bcrypt phù hợp với API cho các tài khoản demo và sử dụng ID trả về, không giả định identity bắt đầu từ 1.

Kiểm tra bản gộp bằng `node tools/validate_dbeaver.js`: 67 statement, phụ thuộc FK theo đúng thứ tự, các chuỗi và ngoặc cân bằng, không có lệnh xóa/reset dữ liệu, đủ 10 ca khi cài và 10 ca diagnostics chạy lại, mật khẩu demo hợp lệ. Đây là kiểm tra tĩnh, không phải compiler PL/SQL hay mô phỏng parser DBeaver. Cần thực thi file trên máy Oracle đích và lưu kết quả CORE_CHECKS/USER_ERRORS để xác nhận.

## Bản PostgreSQL phục vụ test cục bộ

Theo yêu cầu chuyển hệ quản trị để test, đã có `DE_TAI_23_POSTGRESQL.sql`, tách khỏi bản Oracle. Đã thực thi trên PostgreSQL nhúng 17.5: 12 ca nghiệp vụ PASS, 8 bộ đếm bất thường bằng 0, 4 execution plan; kiểm tra cài lại bị chặn mà không phá dữ liệu và đặt vé qua PostgreSQL TCP rồi rollback thành công. Kết quả chi tiết ở `postgres-test/verification-result.json` và `postgres-test/tcp-verification-result.json`.

Môi trường DBeaver cục bộ chạy qua PGlite Socket tại localhost:5433, dữ liệu riêng trong `postgres-test/data`. Môi trường nhúng chỉ có một backend nên không chứng minh tính đúng đắn với nhiều session; kiểm thử concurrency/isolation vẫn cần PostgreSQL server thật. Bản PostgreSQL không đáp ứng thay yêu cầu Oracle 23ai của PDF. Backend Express vẫn dùng Oracle; chỉ phần SQL được chuyển và có môi trường test riêng. Xem `postgres-test/README.md`.

## Web PostgreSQL độc lập để test nghiệp vụ

Theo yêu cầu tạo web mới, có `flight-booking-test-web`, cổng 3001, dữ liệu riêng trong thư mục `data` của bản web. Web dùng Express + PostgreSQL nhúng trực tiếp nên không phụ thuộc Oracle hoặc socket DBeaver 5433. Có đăng nhập/đăng ký, tìm chuyến, chọn ghế, ba chế độ giữ ghế, checkout, vé của chủ sở hữu, flash sale, giả lập hết hạn và phòng lab admin. Không thay thế hoặc chỉnh driver Oracle của bản web gốc.

Đã chạy đạt 14/14 API integration tests trên PostgreSQL nhúng. Đã kiểm tra trình duyệt Chrome: đăng nhập, đăng ký, giữ ghế/checkout, hold optimistic và expiry, 12 kịch bản SQL độc lập, 8 đối soát, xem execution plan, quyền khách hàng và giao diện mobile; không có JavaScript page error. Đã phát hiện và sửa lỗi tràn ngang, nút logout mobile và favicon trong quá trình browser QA. Dữ liệu dùng kiểm thử tự động nằm trong RAM, tách khỏi dữ liệu thao tác của người dùng.

Phòng lab chạy các ca lỗi trên database tạm và đọc invariant trực tiếp trên database web đang dùng. Không có chứng nhận tải nhiều session: PGlite chỉ có một backend. Bản này không phải kết quả kiểm thử runtime Oracle và không thay thế phần Oracle bắt buộc trong PDF. Chi tiết tại `flight-booking-test-web/README.md`.

## Hoàn thiện luồng của bản Oracle gốc theo SQL DBeaver

Bản gốc ban đầu đã có ô ghế dạng radio để bấm và gọi API giữ–thanh toán ngay. Đã thay bằng component dùng chung trên trang chuyến bay và trang flash sale: hiển thị cả AVAILABLE/HOLD/BOOKED; ghế người khác giữ/đã bán không thể chọn; giữ chỗ commit riêng; đếm ngược 10 phút; chọn giá thường/flash sale; checkout reservation cụ thể, không truy vấn “giữ chỗ mới nhất”. Trang `reservations.html` cho mở lại và tiếp tục thanh toán sau khi đóng modal.

Giao diện chọn được PESSIMISTIC, OPTIMISTIC/version và AUTO/SKIP LOCKED. Bổ sung `hold_auto_seat(..., OUT reservation_id)`; wrapper tên cũ giữ tương thích. API checkout xác định chủ sở hữu từ JWT/Oracle, không nhận user ID hoặc giá client để quyết định thanh toán.

Admin có `admin-business.html`: đọc package/status/lỗi biên dịch, integrity, audit, payment, quota và plan đã lưu; gọi dọn giữ chỗ hết hạn; chạy `pkg_booking_diagnostics.run_smoke_tests`. Package mới tạo fixture riêng và rollback toàn bộ fixture, không phụ thuộc ghế demo còn trống. Identity có thể tăng số do test. Không tạo kết quả PASS khi lời gọi Oracle thất bại.

File cài mới `DE_TAI_23_DBEAVER.sql` đã gộp 3 package và phần này. File `DE_TAI_23_CAP_NHAT_WEB.sql` dành cho schema đã cài trước, không seed lại hoặc xóa dữ liệu. Kiểm tra tĩnh bundle đạt; bản gốc đạt 26/26 test service/API với driver giả lập và browser UI contract test với HTTP fixtures. Kết quả UI ghi rõ `oracleExecuted=false`; đây không phải chứng cứ biên dịch/thực thi Oracle.

Đã thử kết nối lại Oracle trong workspace: NJS-503/ECONNREFUSED tại localhost:1522. Cần chạy SQL cập nhật trên Oracle thật, restart bản gốc ở cổng 3000, rồi chạy `npm run test:oracle` và kiểm thử end-to-end trước khi xác nhận runtime. Bản PostgreSQL test cổng 3001 vẫn độc lập, không thay cho việc xác minh này.
