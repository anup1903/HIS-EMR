# HIS System - Architecture Blueprint

> Hospital Information System (HIS) - Complete Architecture & Flow Documentation
> Generated: February 27, 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Database Layer](#5-database-layer)
6. [API Layer](#6-api-layer)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Navigation & Role-Based UI](#8-navigation--role-based-ui)
9. [Data Flow](#9-data-flow)
10. [Docker & Deployment](#10-docker--deployment)
11. [Module Inventory](#11-module-inventory)
12. [Key Design Patterns](#12-key-design-patterns)
13. [Scalability & Security](#13-scalability--security)

---

## 1. System Overview

```
+-----------------------------------------------------------+
|                    HIS System Architecture                  |
+-----------------------------------------------------------+
|                                                             |
|  +---------+     +------------------+     +--------------+ |
|  | Browser | --> | Next.js App      | --> | PostgreSQL   | |
|  | Client  | <-- | (Port 9003)      | <-- | (Port 9004)  | |
|  +---------+     +------------------+     +--------------+ |
|                         |                                   |
|                  +------+------+                            |
|                  |             |                            |
|              Middleware    API Routes                       |
|             (Auth/RBAC)   (RESTful)                        |
|                  |             |                            |
|              NextAuth      Prisma ORM                      |
|             (JWT/Session)  (Query Builder)                  |
|                                                             |
+-----------------------------------------------------------+
|              Docker Compose Orchestration                   |
|  [db: postgres:16] [app: node:20] [migrate: prisma push]  |
+-----------------------------------------------------------+
```

The HIS is a full-stack monolithic web application built on **Next.js 16** with the App Router. It serves as a comprehensive hospital management platform covering 26 functional modules - from patient registration through billing, pharmacy, laboratory, radiology, surgery, emergency, and more.

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router) | 16.1.6 |
| **Language** | TypeScript | 5.x |
| **Runtime** | Node.js | 20 (Alpine) |
| **Database** | PostgreSQL | 16 |
| **ORM** | Prisma | 6.19.2 |
| **Authentication** | NextAuth.js | 4.24.13 |
| **UI Components** | Radix UI | 15+ packages |
| **Icons** | Lucide React | 575+ icons |
| **CSS Framework** | Tailwind CSS | 4.x |
| **Form Handling** | React Hook Form + Zod | - |
| **Data Tables** | TanStack React Table | - |
| **Styling Variants** | Class Variance Authority | - |
| **Password Hashing** | bcryptjs | - |
| **Deployment** | Docker + Docker Compose | - |

---

## 3. Project Structure

```
his-system/
├── prisma/
│   ├── schema.prisma          # 71 models, 17 enums
│   ├── seed.ts                # Database seeding (admin user, sample data)
│   └── migrations/            # Prisma migration history
│
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Providers: Theme + Auth)
│   │   ├── page.tsx           # Landing page (redirects to /login)
│   │   ├── loading.tsx        # Global loading spinner
│   │   ├── globals.css        # Tailwind + custom CSS variables
│   │   │
│   │   ├── (auth)/
│   │   │   └── login/page.tsx # Login page with credentials form
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx     # Dashboard shell (Sidebar + Header)
│   │   │   ├── dashboard/     # Main dashboard with stats
│   │   │   ├── patients/      # Patient management (list, new, detail, edit)
│   │   │   ├── appointments/  # Appointment scheduling
│   │   │   ├── opd/           # Outpatient (consultations, queue)
│   │   │   ├── ipd/           # Inpatient (admissions, beds, nursing)
│   │   │   ├── billing/       # Invoicing & payments
│   │   │   ├── pharmacy/      # Drug management & dispensing
│   │   │   ├── laboratory/    # Lab orders & results
│   │   │   ├── radiology/     # Imaging orders & reports
│   │   │   ├── inventory/     # Store & purchase orders
│   │   │   ├── hr/            # HR, payroll, attendance, leave
│   │   │   ├── emr/           # Electronic Medical Records
│   │   │   ├── surgery/       # Operation theatre & WHO checklist
│   │   │   ├── insurance/     # Claims, providers, policies
│   │   │   ├── emergency/     # ER visits & triage
│   │   │   ├── blood-bank/    # Donors, inventory, requests
│   │   │   ├── queue/         # Token/queue management (live board)
│   │   │   ├── telemedicine/  # Teleconsultation sessions
│   │   │   ├── dietary/       # Diet plans & meal orders
│   │   │   ├── cssd/          # Sterilization batches & instruments
│   │   │   ├── ambulance/     # Fleet, vehicles, dispatch
│   │   │   ├── physiotherapy/ # Therapy plans & sessions
│   │   │   ├── documents/     # Document management & upload
│   │   │   ├── reports/       # Financial & patient analytics
│   │   │   ├── analytics/     # MIS analytics
│   │   │   └── settings/      # Hospital config, users, roles
│   │   │
│   │   └── api/               # 29+ RESTful API route handlers
│   │       ├── auth/[...nextauth]/ # NextAuth endpoint
│   │       ├── patients/      # CRUD + search
│   │       ├── appointments/  # CRUD + available slots
│   │       ├── opd/           # Consultations, vitals, queue
│   │       ├── ipd/           # Admissions, beds, wards
│   │       ├── billing/       # Invoices, payments
│   │       ├── pharmacy/      # Drugs, prescriptions, dispense
│   │       ├── laboratory/    # Orders, tests, results
│   │       ├── radiology/     # Orders, modalities, exams
│   │       ├── inventory/     # Items, suppliers, purchase orders
│   │       ├── hr/            # Employees, attendance, payroll
│   │       ├── emr/           # Medical records
│   │       ├── surgery/       # Surgeries, theatres, checklists
│   │       ├── insurance/     # Claims, providers, policies
│   │       ├── emergency/     # ER visits
│   │       ├── blood-bank/    # Donors, inventory, requests
│   │       ├── queue/         # Tokens, counters
│   │       ├── telemedicine/  # Sessions
│   │       ├── dietary/       # Diet plans, meals
│   │       ├── cssd/          # Instruments, batches
│   │       ├── ambulance/     # Vehicles, dispatches
│   │       ├── physiotherapy/ # Plans, sessions
│   │       ├── documents/     # Upload, retrieve
│   │       ├── dashboard/     # Stats aggregation
│   │       ├── reports/       # Report generation
│   │       └── settings/      # Hospital, users, config
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx    # Collapsible nav with role filtering
│   │   │   └── header.tsx     # Top bar with user menu
│   │   ├── shared/
│   │   │   ├── page-header.tsx    # Page title + actions
│   │   │   ├── search-input.tsx   # Debounced search
│   │   │   ├── status-badge.tsx   # Color-coded status
│   │   │   ├── stats-card.tsx     # Dashboard stat card
│   │   │   ├── empty-state.tsx    # No data placeholder
│   │   │   └── confirm-dialog.tsx # Action confirmation
│   │   ├── ui/                # 20+ Radix UI wrapper components
│   │   └── providers/
│   │       ├── auth-provider.tsx   # NextAuth SessionProvider
│   │       └── theme-provider.tsx  # next-themes provider
│   │
│   ├── hooks/
│   │   └── use-debounce.ts    # Generic debounce hook
│   │
│   ├── lib/
│   │   ├── prisma.ts          # Singleton PrismaClient
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── utils.ts           # cn(), formatCurrency(), formatDate()
│   │   ├── constants/
│   │   │   ├── roles.ts       # PERMISSIONS matrix
│   │   │   ├── status.ts      # Status enums
│   │   │   └── navigation.ts  # NAV_ITEMS array
│   │   ├── helpers/
│   │   │   ├── api-response.ts    # successResponse, errorResponse
│   │   │   ├── rbac.ts           # requireAuth(), getAuthSession()
│   │   │   ├── pagination.ts     # parsePagination()
│   │   │   ├── id-generator.ts   # 16 sequential ID generators
│   │   │   └── date.ts          # Date formatting
│   │   └── validations/       # 20+ Zod schemas
│   │
│   ├── middleware.ts          # Route protection + RBAC
│   └── types/
│       ├── api.ts             # ApiResponse<T> interface
│       └── next-auth.d.ts     # NextAuth type extensions
│
├── docker-compose.yml         # 3-service orchestration
├── Dockerfile                 # Multi-stage production build
├── Dockerfile.migrate         # DB migration container
├── next.config.ts             # Standalone output + TS config
├── prisma.config.ts           # Prisma engine config
├── tailwind.config.ts         # Theme & design tokens
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies & scripts
```

---

## 4. Authentication & Authorization

### Authentication Flow

```
                         LOGIN FLOW
┌──────────┐    ┌──────────────┐    ┌───────────┐    ┌──────────┐
│  Login   │───>│  NextAuth    │───>│  Prisma   │───>│ PostgreSQL│
│  Form    │    │  Credentials │    │  Lookup   │    │  Users   │
│          │<───│  Provider    │<───│  bcrypt   │<───│  Table   │
│ (email,  │    │              │    │  verify   │    │          │
│  password│    │  JWT Token   │    │           │    │          │
│         )│    │  Generated   │    │           │    │          │
└──────────┘    └──────────────┘    └───────────┘    └──────────┘
                       │
                       ▼
              ┌────────────────┐
              │  JWT Cookie    │
              │  Contains:     │
              │  - user.id     │
              │  - user.email  │
              │  - user.name   │
              │  - user.role   │
              └────────────────┘
```

**Configuration** (`src/lib/auth.ts`):
- **Provider**: CredentialsProvider (email + password)
- **Strategy**: JWT (stateless, scalable)
- **Adapter**: PrismaAdapter (user persistence)
- **Password**: bcryptjs hashing
- **Session Extension**: JWT enriched with `id` and `role`
- **Pages**: Custom login at `/login`

### Authorization (RBAC)

**8 System Roles**:

| Role | Access Scope |
|------|-------------|
| `ADMIN` | Full access to all 12 permission modules |
| `DOCTOR` | patients, appointments, opd, ipd, billing (view), pharmacy, laboratory, radiology, reports |
| `NURSE` | patients, appointments, opd, ipd, pharmacy, laboratory, radiology |
| `RECEPTIONIST` | patients, appointments, opd, billing |
| `PHARMACIST` | patients, pharmacy, inventory |
| `LAB_TECHNICIAN` | patients, laboratory |
| `RADIOLOGIST` | patients, radiology |
| `ACCOUNTANT` | billing, reports, hr, inventory |

**Enforcement Points**:

1. **Middleware** (`src/middleware.ts`) - Route-level protection
   - Maps URL paths to modules
   - Blocks unauthorized navigation
   - Redirects to `/login` if unauthenticated

2. **API Route Handlers** - Action-level protection
   ```typescript
   const { error } = await requireAuth("patients", "create");
   if (error) return error; // 401 or 403 response
   ```

3. **Sidebar UI** - Visual filtering
   - Hides navigation items user cannot access

---

## 5. Database Layer

### Schema Overview

- **71 Prisma Models** across 26 functional modules
- **17 Enums** for type-safe status/category fields
- **Provider**: PostgreSQL 16

### Entity Relationship Diagram (Simplified)

```
                            ┌─────────────┐
                            │    User     │
                            │  (8 roles)  │
                            └──────┬──────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
               ┌────▼────┐   ┌────▼────┐   ┌────▼─────┐
               │ Doctor  │   │Employee │   │ AuditLog │
               └────┬────┘   └────┬────┘   └──────────┘
                    │              │
        ┌───────────┼──────┐      │
        │           │      │      │
   ┌────▼────┐ ┌───▼───┐ ┌▼──────▼────┐
   │Schedule │ │Consult│ │  Admission  │
   └─────────┘ └───┬───┘ └──────┬─────┘
                    │            │
              ┌─────────────────┤
              │                 │
         ┌────▼────┐    ┌──────▼──────┐
         │ Patient │    │   Invoice   │
         │ (Hub)   │    │  Billing    │
         └────┬────┘    └─────────────┘
              │
    ┌─────────┼─────────┬──────────┬──────────┐
    │         │         │          │          │
┌───▼──┐ ┌───▼───┐ ┌───▼──┐ ┌────▼───┐ ┌────▼────┐
│Appt  │ │ EMR   │ │Lab   │ │Pharmacy│ │Radiology│
│      │ │Record │ │Order │ │Rx/Drug │ │Order    │
└──────┘ └───────┘ └──────┘ └────────┘ └─────────┘
    │
    ├── Emergency Visit
    ├── Surgery
    ├── Insurance Policy/Claim
    ├── Blood Request
    ├── Diet Plan
    ├── Therapy Plan
    ├── Teleconsult Session
    └── Documents
```

### Core Enums

| Enum | Values |
|------|--------|
| `Role` | ADMIN, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST, LAB_TECHNICIAN, RADIOLOGIST, ACCOUNTANT |
| `Gender` | MALE, FEMALE, OTHER |
| `BloodGroup` | A_POSITIVE, A_NEGATIVE, B_POSITIVE, B_NEGATIVE, AB_POSITIVE, AB_NEGATIVE, O_POSITIVE, O_NEGATIVE |
| `AppointmentStatus` | SCHEDULED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW |
| `AdmissionStatus` | ADMITTED, DISCHARGED, TRANSFERRED, DECEASED |
| `BedStatus` | AVAILABLE, OCCUPIED, MAINTENANCE, RESERVED |
| `InvoiceStatus` | DRAFT, ISSUED, PARTIALLY_PAID, PAID, CANCELLED, REFUNDED |
| `PaymentMethod` | CASH, CARD, UPI, INSURANCE, BANK_TRANSFER, CHEQUE |
| `OrderStatus` | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| `TriageLevel` | RESUSCITATION, EMERGENT, URGENT, LESS_URGENT, NON_URGENT |
| `ClaimStatus` | DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, PARTIALLY_APPROVED, REJECTED, SETTLED, APPEALED |
| `SurgeryStatus` | SCHEDULED, PREP, IN_PROGRESS, RECOVERY, COMPLETED, CANCELLED |
| `BloodComponent` | WHOLE_BLOOD, PACKED_RBC, PLATELET, PLASMA, CRYOPRECIPITATE |
| `SterilizationStatus` | PENDING, IN_PROGRESS, STERILIZED, ISSUED, RETURNED |
| `AmbulanceStatus` | AVAILABLE, DISPATCHED, EN_ROUTE, AT_SCENE, RETURNING, MAINTENANCE |
| `PurchaseOrderStatus` | DRAFT, SUBMITTED, APPROVED, RECEIVED, CANCELLED |
| `LeaveStatus` | PENDING, APPROVED, REJECTED, CANCELLED |
| `PayrollStatus` | DRAFT, PROCESSED, PAID |

### Model Categories (71 Models)

| Category | Models | Count |
|----------|--------|-------|
| Auth & Users | User, Account, Session, VerificationToken | 4 |
| Hospital Config | Hospital, Department | 2 |
| Patient Management | Patient, PatientDocument, MedicalRecord | 3 |
| Doctors & Staff | Doctor, DoctorSchedule, Employee | 3 |
| Appointments | Appointment | 1 |
| OPD | Vitals, Consultation | 2 |
| IPD | Ward, Bed, Admission, ProgressNote, DoctorOrder | 5 |
| Billing | Invoice, InvoiceItem, Payment | 3 |
| Pharmacy | Drug, Prescription, PrescriptionItem, Dispensing | 4 |
| Laboratory | LabTest, LabOrder, LabOrderItem | 3 |
| Radiology | Modality, RadiologyExamType, RadiologyOrder, RadiologyOrderItem | 4 |
| Inventory | InventoryCategory, InventoryItem, Supplier, PurchaseOrder, PurchaseOrderItem, StockTransaction | 6 |
| HR & Payroll | Attendance, LeaveRequest, PayrollRun, Payslip | 4 |
| Insurance | InsuranceProvider, InsurancePolicy, InsuranceClaim, PreAuthorization, ClaimDocument | 5 |
| Surgery/OT | OperationTheatre, Surgery, SurgeryTeamMember, SurgeryChecklist | 4 |
| Emergency | EmergencyVisit | 1 |
| Blood Bank | BloodDonor, BloodDonation, BloodInventory, BloodRequest, BloodIssuance | 5 |
| Queue | QueueToken, QueueCounter | 2 |
| Telemedicine | TeleconsultSession | 1 |
| Dietary | DietPlan, MealOrder | 2 |
| CSSD | InstrumentSet, SterilizationBatch | 2 |
| Ambulance | Ambulance, AmbulanceDispatch | 2 |
| Physiotherapy | TherapyPlan, TherapySession | 2 |
| Audit | AuditLog | 1 |

### Key Relationships
- **Patient** is the central hub, connected to 15+ modules
- **User** links to Doctor, Employee, and all audit trails
- **Admission** connects to Vitals, ProgressNotes, DoctorOrders, Invoices
- **Soft deletes** (`deletedAt`) used across all major entities

---

## 6. API Layer

### Route Architecture

All API routes follow RESTful conventions under `/api/{module}/{resource}`:

```
/api/
├── auth/[...nextauth]/        # NextAuth authentication
├── patients/                  # GET (list), POST (create)
│   ├── [id]/                  # GET, PUT, DELETE
│   └── search/                # GET (advanced search)
├── appointments/              # GET, POST
│   ├── [id]/                  # GET, PUT, DELETE
│   └── available-slots/       # GET (slot finder)
├── opd/
│   ├── consultations/         # GET, POST
│   ├── consultations/[id]/    # GET, PUT
│   ├── vitals/                # GET, POST
│   └── queue/                 # GET
├── ipd/
│   ├── admissions/            # GET, POST
│   ├── admissions/[id]/       # GET, PUT
│   ├── beds/                  # GET, PUT
│   └── wards/                 # GET, POST
├── billing/
│   ├── invoices/              # GET, POST
│   ├── invoices/[id]/         # GET, PUT
│   └── payments/              # POST
├── pharmacy/
│   ├── drugs/                 # GET, POST
│   ├── drugs/[id]/            # GET, PUT
│   ├── prescriptions/         # GET, POST
│   └── dispense/              # POST
├── laboratory/
│   ├── orders/                # GET, POST
│   ├── results/[id]/          # GET, PUT
│   └── tests/                 # GET, POST
├── radiology/                 # (similar pattern)
├── inventory/                 # (similar pattern)
├── hr/                        # (similar pattern)
├── surgery/                   # (similar pattern)
├── insurance/                 # (similar pattern)
├── emergency/                 # (similar pattern)
├── blood-bank/                # (similar pattern)
├── queue/                     # (similar pattern)
├── telemedicine/              # (similar pattern)
├── dietary/                   # (similar pattern)
├── cssd/                      # (similar pattern)
├── ambulance/                 # (similar pattern)
├── physiotherapy/             # (similar pattern)
├── documents/                 # (similar pattern)
├── emr/                       # (similar pattern)
├── dashboard/stats/           # GET (aggregated stats)
├── reports/                   # GET (report generation)
└── settings/
    ├── hospital/              # GET, PUT
    └── users/                 # GET, POST
```

### Standardized Response Format

```typescript
// Success with pagination
{
  success: true,
  data: [...],
  meta: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8
  }
}

// Success (single resource or create)
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: "Description of what went wrong"
}
```

### API Route Handler Pattern

Every API route follows this consistent pattern:

```
1. AUTH CHECK      →  requireAuth(module, action)
2. PARSE PARAMS   →  searchParams, pagination
3. VALIDATE BODY  →  Zod schema.safeParse(body)
4. DB OPERATION   →  Prisma query (with soft-delete filter)
5. RESPONSE       →  successResponse() or errorResponse()
```

### Helper Functions

| Helper | Location | Purpose |
|--------|----------|---------|
| `successResponse(data, meta?)` | `src/lib/helpers/api-response.ts` | 200 OK response |
| `createdResponse(data)` | `src/lib/helpers/api-response.ts` | 201 Created response |
| `errorResponse(msg, status)` | `src/lib/helpers/api-response.ts` | Error response |
| `requireAuth(module, action)` | `src/lib/helpers/rbac.ts` | Auth + permission check |
| `getAuthSession()` | `src/lib/helpers/rbac.ts` | Get current session |
| `parsePagination(params)` | `src/lib/helpers/pagination.ts` | Extract page/limit/skip |
| `generateMRN()` | `src/lib/helpers/id-generator.ts` | Patient MRN generation |
| `generate*No()` | `src/lib/helpers/id-generator.ts` | 16 sequential ID generators |

### ID Generation Pattern

All entities use date-based sequential IDs:
```
MRN-20260227-0001       (Patient)
APT-20260227-0001       (Appointment)
CON-20260227-0001       (Consultation)
ADM-20260227-0001       (Admission)
INV-20260227-0001       (Invoice)
PAY-20260227-0001       (Payment)
RX-20260227-0001        (Prescription)
LO-20260227-0001        (Lab Order)
RO-20260227-0001        (Radiology Order)
PO-20260227-0001        (Purchase Order)
CLM-20260227-0001       (Insurance Claim)
SRG-20260227-0001       (Surgery)
ER-20260227-0001        (Emergency Visit)
BD-20260227-0001        (Blood Donation)
TKN-20260227-0001       (Queue Token)
TP-20260227-0001        (Therapy Plan)
```

---

## 7. Frontend Architecture

### Component Hierarchy

```
RootLayout (layout.tsx)
├── ThemeProvider (light/dark mode)
│   └── AuthProvider (NextAuth session)
│       │
│       ├── (auth)/login/page.tsx          # Unauthenticated
│       │
│       └── (dashboard)/layout.tsx         # Authenticated
│           ├── Sidebar (collapsible, role-filtered)
│           ├── Header (toggle, user menu, theme)
│           └── <main> Content Area
│               ├── PageHeader (title, breadcrumbs, actions)
│               ├── StatsCard Grid (key metrics)
│               ├── Tabs (data categories)
│               │   └── Card → Table (data display)
│               └── Dialogs/Forms (create/edit)
```

### Page Pattern (All Module Pages)

Every dashboard page follows this consistent structure:

```typescript
"use client";

export default function ModulePage() {
  // 1. State management
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 2. Data fetching
  useEffect(() => {
    async function fetchData() {
      const [dataRes, statsRes] = await Promise.all([
        fetch("/api/module?search=" + search),
        fetch("/api/module/stats"),
      ]);
      // ... parse and set state
    }
    fetchData();
  }, [search]);

  // 3. Render
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Module" actions={[...]} />
      <div className="grid grid-cols-4 gap-4">
        <StatsCard ... />
      </div>
      <Tabs>
        <TabsList>
          <TabsTrigger>Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent>
          <Card>
            <Table>...</Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### UI Component Library

All UI components are Radix UI primitives wrapped with Tailwind CSS:

| Component | Source | Usage |
|-----------|--------|-------|
| Button | `@radix-ui/react-slot` + CVA | Actions, navigation |
| Dialog | `@radix-ui/react-dialog` | Modals, forms |
| Select | `@radix-ui/react-select` | Dropdowns |
| Tabs | `@radix-ui/react-tabs` | Content switching |
| DropdownMenu | `@radix-ui/react-dropdown-menu` | Context menus |
| AlertDialog | `@radix-ui/react-alert-dialog` | Confirmations |
| Tooltip | `@radix-ui/react-tooltip` | Hover info |
| Popover | `@radix-ui/react-popover` | Date pickers |
| ScrollArea | `@radix-ui/react-scroll-area` | Sidebar scroll |
| Switch | `@radix-ui/react-switch` | Toggles |
| Label | `@radix-ui/react-label` | Form labels |
| Separator | `@radix-ui/react-separator` | Visual dividers |
| Avatar | `@radix-ui/react-avatar` | User avatars |
| Badge | Custom | Status indicators |
| Card | Custom | Content containers |
| Table | Custom | Data display |
| Input | Custom | Text inputs |
| Textarea | Custom | Multi-line inputs |

### State Management

- **No external state library** (no Redux, Zustand, or Jotai)
- **React hooks** (`useState`, `useEffect`) for component state
- **NextAuth SessionProvider** for auth state
- **Server-side data fetching** via API routes
- **Form state** via React Hook Form

### Validation (Zod Schemas)

20+ validation schemas in `src/lib/validations/`:

```
patient.ts, appointment.ts, consultation.ts, billing.ts,
pharmacy.ts, laboratory.ts, radiology.ts, inventory.ts,
auth.ts, hr.ts, emr.ts, insurance.ts, surgery.ts,
emergency.ts, blood-bank.ts, telemedicine.ts, dietary.ts,
cssd.ts, ambulance.ts, physiotherapy.ts
```

Each exports:
- `*CreateSchema` - Create validation
- `*UpdateSchema` - Partial update validation
- `*CreateInput` - TypeScript type (inferred from Zod)
- `*UpdateInput` - TypeScript type (inferred from Zod)

---

## 8. Navigation & Role-Based UI

### Sidebar Navigation (26 Items)

```
Dashboard           LayoutDashboard     → /dashboard
Patients            Users               → /patients
  ├── All Patients                      → /patients
  └── Register New                      → /patients/new
Appointments        Calendar            → /appointments
Emergency           Siren               → /emergency
  ├── Active Cases                      → /emergency
  └── New Visit                         → /emergency/new
OPD                 Stethoscope         → /opd
  ├── Queue                             → /opd/queue
  └── Consultations                     → /opd
IPD                 BedDouble           → /ipd
  ├── Admissions                        → /ipd
  ├── Bed Management                    → /ipd/beds
  └── Nursing Station                   → /ipd/nursing
EMR                 FileHeart           → /emr
Operation Theatre   Scissors            → /surgery
  ├── Schedule                          → /surgery
  └── Theatres                          → /surgery/theatres
Billing             Receipt             → /billing
Insurance/TPA       Shield              → /insurance
  ├── Claims                            → /insurance
  ├── Providers                         → /insurance/providers
  └── Policies                          → /insurance/policies
Pharmacy            Pill                → /pharmacy
Laboratory          FlaskConical        → /laboratory
Radiology           ScanLine            → /radiology
Blood Bank          Droplets            → /blood-bank
  ├── Inventory                         → /blood-bank
  ├── Donors                            → /blood-bank/donors
  └── Requests                          → /blood-bank/requests
Queue Display       ListOrdered         → /queue
Telemedicine        Video               → /telemedicine
Physiotherapy       Dumbbell            → /physiotherapy
Dietary             UtensilsCrossed     → /dietary
CSSD                SprayCan            → /cssd
Ambulance           Ambulance           → /ambulance
Documents           FileText            → /documents
Inventory           Package             → /inventory
HR & Payroll        Building2           → /hr
  ├── Employees                         → /hr/employees
  ├── Departments                       → /hr/departments
  ├── Attendance                        → /hr/attendance
  ├── Leave                             → /hr/leave
  └── Payroll                           → /hr/payroll
MIS Analytics       Activity            → /analytics
Reports             BarChart3           → /reports
Settings            Settings            → /settings
```

### Role-Based Visibility

The sidebar filters items based on the user's role using the `PERMISSIONS` matrix. Each nav item has a `module` property that maps to the permission check:

```
ADMIN sees       → ALL 26 items
DOCTOR sees      → 15+ items (clinical + patient)
NURSE sees       → 12+ items (ward + clinical)
RECEPTIONIST sees → 5 items (front desk)
PHARMACIST sees  → 4 items (pharmacy + inventory)
LAB_TECHNICIAN   → 3 items (lab focused)
RADIOLOGIST      → 3 items (radiology focused)
ACCOUNTANT       → 5 items (billing + financial)
```

---

## 9. Data Flow

### Complete Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                             │
│                                                                     │
│  User Action (click, form submit, page load)                       │
│       │                                                             │
│       ▼                                                             │
│  React Component (useState, useEffect)                             │
│       │                                                             │
│       ▼                                                             │
│  fetch("/api/module", { method, body, headers })                   │
└───────┬─────────────────────────────────────────────────────────────┘
        │ HTTP Request
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                        MIDDLEWARE                                  │
│                                                                    │
│  1. Check if path requires auth (matcher config)                  │
│  2. Get JWT token from cookie                                     │
│  3. Decode token → extract user.role                              │
│  4. Map URL path → module name                                    │
│  5. Check PERMISSIONS[role].includes(module)                      │
│  6. Allow or redirect to /login                                   │
└───────┬───────────────────────────────────────────────────────────┘
        │ (Authorized)
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                     API ROUTE HANDLER                              │
│                                                                    │
│  1. requireAuth(module, action) → Session + Permission             │
│  2. Parse URL searchParams (pagination, filters, search)          │
│  3. Parse request body → Zod validation                           │
│  4. Build Prisma where clause (always: { deletedAt: null })       │
│  5. Execute Prisma query (findMany, create, update, etc.)         │
│  6. Return standardized JSON response                             │
└───────┬───────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                      PRISMA ORM                                    │
│                                                                    │
│  Singleton PrismaClient (dev: global cache, prod: single)         │
│       │                                                            │
│       ▼                                                            │
│  SQL Query Generation → Connection Pool → PostgreSQL              │
│       │                                                            │
│       ▼                                                            │
│  Result → Type-safe object mapping                                │
└───────┬───────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                     PostgreSQL 16                                  │
│                                                                    │
│  71 tables, indexes, foreign keys, enums                          │
│  Soft deletes (deletedAt IS NULL filter)                          │
│  Cascading relations                                              │
└───────────────────────────────────────────────────────────────────┘
```

### Example: Patient Registration Flow

```
1. User navigates to /patients/new
   └─ Middleware checks: role has "patients" permission ✓

2. User fills form → clicks "Register"
   └─ React Hook Form validates with patientCreateSchema (Zod)

3. Client sends POST /api/patients
   └─ Body: { firstName, lastName, dateOfBirth, gender, phone, ... }

4. API Handler:
   a. requireAuth("patients", "create") → checks session + role
   b. patientCreateSchema.safeParse(body) → validates input
   c. generateMRN() → "MRN-20260227-0001"
   d. prisma.patient.create({ data: { ...body, mrn } })
   e. return createdResponse(patient) → 201

5. Client receives response → redirect to /patients/[id]
```

### Example: OPD Consultation Flow

```
1. Patient checks in at reception → Appointment status: CHECKED_IN
2. Queue token generated → TKN-20260227-0001
3. Queue display shows token → auto-refresh every 10 seconds
4. Doctor calls patient:
   a. Queue token → IN_PROGRESS
   b. Record vitals (BP, temp, pulse, SpO2, weight, height → BMI)
   c. Create consultation (complaint, diagnosis, ICD codes, treatment plan)
   d. Prescribe medications → Prescription items
   e. Order lab tests → Lab order
   f. Order radiology → Radiology order
5. Consultation complete → Queue token: COMPLETED
6. Patient goes to pharmacy → Prescription dispensed
7. Patient goes to billing → Invoice generated
```

---

## 10. Docker & Deployment

### Container Architecture

```
docker-compose up -d
         │
         ├── [1] db (postgres:16-alpine)
         │    ├── Port: 9004 → 5432
         │    ├── Volume: his_pgdata
         │    ├── Database: his_system
         │    ├── User: postgres/postgres
         │    └── Healthcheck: pg_isready (5s interval)
         │
         ├── [2] migrate (one-shot, depends on db:healthy)
         │    ├── Runs: prisma db push (schema sync)
         │    ├── Runs: prisma db seed (initial data)
         │    └── Exits after completion (restart: "no")
         │
         └── [3] app (Next.js, depends on db:healthy)
              ├── Port: 9003 → 3000
              ├── Multi-stage build (4 stages)
              ├── Standalone output (~minimal image)
              └── Restart: unless-stopped
```

### Dockerfile Multi-Stage Build

```
Stage 1: base
  └── node:20-alpine (minimal footprint)

Stage 2: deps
  ├── COPY package.json, package-lock.json
  ├── npm ci (clean install)
  ├── COPY prisma/schema.prisma
  └── npx prisma generate

Stage 3: builder
  ├── COPY source code
  ├── COPY deps from stage 2
  └── npx next build (standalone output)

Stage 4: runner (Final)
  ├── COPY .next/standalone
  ├── COPY .next/static
  ├── COPY public
  ├── User: nextjs:nodejs (non-root)
  ├── ENV: NODE_ENV=production
  └── CMD: node server.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/his_system` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | (set in compose) | JWT signing secret (min 32 chars) |
| `NEXTAUTH_URL` | `http://localhost:9003` | Application URL for NextAuth |
| `NODE_ENV` | `production` | Runtime environment |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry |

### Quick Start

```bash
# Start all services (db + migrate + app)
docker compose up -d

# View logs
docker compose logs -f app

# Access application
open http://localhost:9003

# Access database directly
psql postgresql://postgres:postgres@localhost:9004/his_system

# Rebuild after code changes
docker compose up -d --build
```

---

## 11. Module Inventory

### All 26 Modules - Complete Status

| # | Module | Pages | API Routes | Prisma Models | Status |
|---|--------|-------|------------|---------------|--------|
| 1 | Authentication | Login | NextAuth | User, Account, Session | FULL |
| 2 | Patient Management | 4 pages | CRUD + Search | Patient, PatientDocument | FULL |
| 3 | Appointments | 3 pages | CRUD + Slots | Appointment | FULL |
| 4 | OPD (Outpatient) | 4 pages | Consultations, Vitals, Queue | Vitals, Consultation | FULL |
| 5 | IPD (Inpatient) | 5 pages | Admissions, Beds, Wards | Ward, Bed, Admission, ProgressNote, DoctorOrder | FULL |
| 6 | Billing | 3 pages | Invoices, Payments | Invoice, InvoiceItem, Payment | FULL |
| 7 | Pharmacy | 4 pages | Drugs, Rx, Dispense | Drug, Prescription, PrescriptionItem, Dispensing | FULL |
| 8 | Laboratory | 2 pages | Orders, Tests, Results | LabTest, LabOrder, LabOrderItem | FULL |
| 9 | Radiology | 2 pages | Orders, Modalities | Modality, ExamType, RadiologyOrder, RadiologyOrderItem | FULL |
| 10 | Inventory | 2 pages | Items, Suppliers, POs | InventoryItem, Supplier, PurchaseOrder | FULL |
| 11 | HR & Payroll | 5 pages | Employees, Attendance, Payroll | Employee, Attendance, LeaveRequest, PayrollRun, Payslip | FULL |
| 12 | EMR | 1 page | Records | MedicalRecord | FULL |
| 13 | Insurance/TPA | 5 pages | Claims, Providers, Policies | InsuranceProvider, InsurancePolicy, InsuranceClaim | FULL |
| 14 | Surgery/OT | 3 pages | Surgeries, Theatres, Checklists | OperationTheatre, Surgery, SurgeryChecklist | FULL |
| 15 | Emergency | 3 pages | Visits | EmergencyVisit | FULL |
| 16 | Blood Bank | 3 pages | Donors, Inventory, Requests | BloodDonor, BloodDonation, BloodInventory, BloodRequest | FULL |
| 17 | Queue/Token | 1 page | Tokens, Counters | QueueToken, QueueCounter | FULL |
| 18 | Telemedicine | 2 pages | Sessions | TeleconsultSession | FULL |
| 19 | Dietary | 2 pages | Plans, Meals | DietPlan, MealOrder | FULL |
| 20 | CSSD | 3 pages | Instruments, Batches | InstrumentSet, SterilizationBatch | FULL |
| 21 | Ambulance | 3 pages | Vehicles, Dispatches | Ambulance, AmbulanceDispatch | FULL |
| 22 | Physiotherapy | 2 pages | Plans, Sessions | TherapyPlan, TherapySession | FULL |
| 23 | Documents | 1 page | Upload, Retrieve | PatientDocument | FULL |
| 24 | Dashboard | 1 page | Stats | (aggregation) | FULL |
| 25 | Reports | 3 pages | Financial, Patients | (aggregation) | FULL |
| 26 | Settings | 4 pages | Hospital, Users, Roles | Hospital, User | FULL |

**Total: 73 routes, 29+ API endpoints, 71 Prisma models**

---

## 12. Key Design Patterns

### 1. Middleware-First RBAC
All routes are protected at the middleware level before reaching route handlers. API routes add a second layer of action-level permission checking.

### 2. Soft Deletes
All major entities use `deletedAt: DateTime?` instead of hard deletes. Every query filters with `{ deletedAt: null }`.

### 3. Date-Based Sequential IDs
Human-readable IDs generated per-day with auto-incrementing counters: `PREFIX-YYYYMMDD-NNNN`.

### 4. Singleton Prisma Client
Global caching in development prevents connection pool exhaustion during hot reload. Production uses a single instance.

### 5. Standardized API Responses
All endpoints return `{ success, data, error?, meta? }` format. Helpers enforce consistency.

### 6. Zod Dual Validation
Client-side validation (React Hook Form + Zod) and server-side validation (Zod in API routes) using shared schemas.

### 7. Parallel Data Fetching
`Promise.all()` used to fetch multiple resources simultaneously on page load.

### 8. Component Composition
Pages compose from shared building blocks: PageHeader → StatsCard → Tabs → Card → Table.

---

## 13. Scalability & Security

### Security Measures
- JWT-based authentication (stateless, no server session storage)
- bcryptjs password hashing (cost factor 10)
- RBAC at middleware + API + UI levels (defense in depth)
- Input validation via Zod schemas (prevents injection)
- Soft deletes (data preservation, audit trail)
- Non-root Docker user (nextjs:nodejs)
- Environment variables for secrets (not hardcoded)

### Scalability Considerations
- **Horizontal scaling**: Stateless JWT allows multiple app instances behind a load balancer
- **Database pooling**: Prisma connection pool manages concurrent connections
- **Standalone build**: Minimal Docker image (~100MB) for fast deployment
- **Pagination**: All list endpoints paginated (max 100 per page)
- **Debounced search**: 500ms delay reduces unnecessary API calls

### Future Enhancement Points
- Redis caching for frequently accessed data (patient lookup, drug catalog)
- WebSocket/SSE for real-time queue updates
- File storage service (S3/MinIO) for documents and images
- Rate limiting middleware for API protection
- Audit log analytics and monitoring dashboard
- Multi-tenant support for hospital chains
- Mobile-responsive progressive web app (PWA)
- HL7/FHIR integration for health information exchange

---

> This document reflects the architecture as of February 27, 2026.
> Total codebase: 26 modules, 71 database models, 73 routes, 29+ API endpoints.
