# Rivera backend integration and gap report

## Frontend coverage

The frontend now exposes every registered backend router resource and every custom action.

- JWT login and refresh, authenticated requests, and client-side logout
- Dashboard summary, client delivery pipeline, products, materials, stock, production, employees, attendance, finance, and approvals
- Advanced Operations for client payments/returns/debt adjustments, all inventory streams, product norms, batch items/material usage, work schedules, face encodings, attendance devices/events/records, operation types, work entries, salary adjustments, and monthly payroll
- System Control for users, page permissions, business settings, backups, audit/export logs, and all security-log types
- Generic create/edit/archive/restore/search/export controls with relation-aware forms
- Payroll calculate/approve/pay/unlock, backup-now, approval/rejection, material issue, production delivery, material calculation, manual attendance, and public device attendance check
- Public attendance kiosk at `/attendance-kiosk`

The frontend deliberately treats computed or security-sensitive resources as read-only even where the backend currently exposes mutation endpoints.

## Critical backend gaps

### 1. Missing current-user endpoint

There is no `/api/auth/me/` endpoint returning the authenticated user and effective page permissions. The frontend can authenticate but cannot reliably display the current identity or hide navigation based on server-authoritative permissions.

Recommended response fields: user ID, username, full name, superadmin flag, and effective `{page: level}` permissions.

### 2. No server-side logout/revocation

JWT logout is client-side token deletion only. Refresh-token blacklisting is not installed/enabled, so a copied refresh token remains valid until expiry.

### 3. Protected ledger resources are writable directly

The backend exposes normal CRUD for records that should only change through domain services:

- material and finished-goods stock totals;
- attendance events;
- monthly payroll calculations;
- approval requests;
- audit/security/export logs;
- backup-run history.

The frontend marks these resources read-only, but another API client can bypass that guard. These viewsets should be read-only or restrict mutation to explicit domain actions.

### 4. Approval transitions are insufficiently guarded

Approve/reject actions do not enforce a strict pending-only transition. Repeated or reversed decisions can be requested. Transition validation and database locking should be added.

### 5. Domain errors can become HTTP 500 responses

Inventory services raise plain `ValueError` for insufficient stock. These should become atomic, structured `400` or `409` API responses with stable error codes.

### 6. Missing audit calls in overridden create/delete methods

Several viewsets override `perform_create` or `perform_destroy` without retaining the base audit behavior, including approval-gated transactions, production batches, and user deactivation. The resulting audit trail is incomplete.

### 7. No automated startup provisioning

Docker startup does not run migrations, collect static files, or provision an initial administrator. The repository also lacks a real `.env`, and the inherited `DEBUG=release` value is invalid for Django's boolean parser.

## Missing business concepts

### Orders and sales workflow

There is no Order/SalesOrder model. The frontend currently maps “Orders” to `ClientDelivery`, but a delivery is not an order. Missing concepts include order number, line items, requested versus fulfilled quantity, manager, quotation/confirmation/cancellation states, deadlines, and links to production batches.

### Procurement and suppliers

Materials have no supplier, purchase order, goods receipt, vendor invoice, or payable model. Incoming material transactions alone cannot represent procurement.

### Warehouses and locations

Stock has no warehouse/location/bin dimension, transfer operation, reservation, or lot/batch traceability.

### Complete finance ledger

The backend tracks client payments and some balance adjustments but has no expense, purchase, cash/bank account, transfer, invoice, tax ledger, or general-ledger model. Profit reporting therefore cannot be authoritative.

### Product catalog metadata

Products lack description, images/gallery, active/recommended flags, finished-goods minimum stock, barcode, supplier, warehouse, and richer composition/specification fields. Product categories only contain a name—no code, description, or sort order.

### Material catalog metadata

Materials lack category, supplier, color, manufacturer/brand, barcode, and media/document fields.

### Employee and HR metadata

Employees lack department, customizable position records, termination history, employment documents, monthly base salary, and leave/absence requests. Positions are hard-coded choices.

### Payroll hour breakdown API

`DailyWorkHourBreakdown` exists as a model and serializer but has no registered viewset/route, so it cannot be managed from the frontend.

## API and security improvements

- Attendance device tokens are stored in plaintext and returned by CRUD serialization. Store only a hash and show a token once at creation.
- The public attendance endpoint should have rate limiting, replay protection, device rotation/revocation, and stronger input validation.
- Add object-level permission checks where users should only access assigned employees/clients rather than every record on a permitted page.
- Add throttling for login, refresh, exports, backups, and attendance checks.
- Add a health/readiness endpoint covering database, Redis, and Celery.
- Add structured, stable API error codes and localization-ready messages.
- Add bulk endpoints for imports, approvals, attendance, stock transactions, and payroll workflows.
- Add nested display fields or lightweight lookup endpoints; most serializers return foreign-key IDs only, forcing many list requests and client-side joins.
- Add backup retention, download, restore-testing, encryption, and secret-exclusion policies. Running backups synchronously in an HTTP request can time out.
- Add immutable audit-log storage and prevent API mutation of audit/security records.

## Reporting gaps

The dashboard API provides only a small summary and top clients by delivered quantity. It lacks authoritative revenue/expense time series, receivables aging, stock valuation history, attendance trends, production efficiency, payroll summaries, and order conversion metrics.

## Quality gaps

- No backend automated test suite was found for permissions, approval transitions, inventory concurrency, payroll calculations, attendance, or backups.
- OpenAPI schema generation reports a status-enum naming collision.
- Model/file validation is limited for face encodings and uploaded images.
- Concurrency tests and row-locking coverage are needed around approval and inventory workflows.

## Recommended backend priority

1. Lock down mutation of computed/log resources and add transition validation.
2. Add `/auth/me/`, logout/blacklisting, throttling, and secure device tokens.
3. Convert domain failures to structured atomic API responses and complete auditing.
4. Add true orders, procurement, warehouse locations, and finance ledger models.
5. Add automated tests and production-safe startup/migration provisioning.
