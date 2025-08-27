quality of life punchlist:
- contents of navbar are not aligned with the contents of the page and footer ie they don't have the same width / horizontal margin/padding -- but they should
- in the "all questions" view the footer covers up the "load more questions" button. the footer should never cover up page content
- we need a way to crud all questions, probably at least from the all questions view
- /quizzes and /dashboard are not clearly different. either /quizzes is a totally redundant view / route that should be deleted, or it should be fleshed out and the dashboard should be simplified to link to it but not show the exact same stuff

---

# Enhanced Specification

## Research Findings

### Industry Best Practices

**Layout Consistency (2025)**:
- Centered max-width containers (1280px/`max-w-7xl`) are the dominant pattern for readability
- CSS Grid for page structure (`grid-template-rows: auto 1fr auto`) prevents overlap issues
- Sticky positioning preferred over fixed for navbar/footer to maintain document flow
- `100dvh` for mobile viewport handling to prevent browser toolbar layout jumps

**CRUD Interface Patterns**:
- Modal editing for complex multi-field operations provides focused experience
- Optimistic UI with automatic rollback on failure reduces perceived latency
- Soft delete with undo capability prevents accidental data loss
- Bulk operations essential for power users managing many items

**Information Architecture**:
- Dashboard as navigational hub with at-a-glance insights
- Detailed list views for comprehensive data management
- Progressive disclosure reduces cognitive load
- Clear differentiation between overview and management views

### Technology Analysis

**Next.js 15 Patterns**:
- Server Components for data fetching, Client Components for interactivity
- Hybrid CRUD: Server Components fetch data, Client Components handle mutations
- Native `<dialog>` element support for accessibility-first modals

**Tailwind CSS v4**:
- Container queries for component-based responsive design
- Grid/Flexbox hybrid layouts for optimal structure
- Gap utilities replace legacy space utilities

**shadcn/ui Components**:
- DataTable with TanStack Table for feature-rich CRUD interfaces
- Dialog components with proper accessibility attributes
- Form components with React Hook Form + Zod validation

### Codebase Integration

**Existing Patterns to Follow**:
- Container pattern: `container mx-auto px-4 py-8` with `max-w-7xl` for large content
- Fixed positioning: Currently `z-50` for navbar/footer with spacer divs
- Form patterns: React Hook Form + Zod with Card wrappers
- Data management: Table rows with hover states, Badge components for status
- Convex mutations: Type-safe with permission checks

## Detailed Requirements

### Functional Requirements

- **FR1: Layout Alignment**: Navbar, content, and footer must share consistent max-width and horizontal padding
  - Acceptance: All three sections align vertically on all screen sizes
  - Implementation: Shared container class with responsive padding

- **FR2: Content Visibility**: Footer must never overlap page content
  - Acceptance: All interactive elements remain accessible with footer present
  - Implementation: Switch from fixed to sticky positioning with proper document flow

- **FR3: Question CRUD Operations**: Users can edit/delete their own questions
  - Acceptance: Creator-only permissions enforced, soft delete preserves FSRS data
  - Implementation: Modal editing, confirmation dialogs, optimistic updates

- **FR4: Route Differentiation**: Clear purpose distinction between /dashboard and /quizzes
  - Acceptance: Users understand navigation purpose without confusion
  - Implementation: Dashboard as overview hub, Quizzes as detailed history

### Non-Functional Requirements

- **Performance**: CRUD operations complete within 500ms with optimistic UI
- **Security**: Creator-only permissions enforced at database level
- **Scalability**: Bulk operations support 100+ questions efficiently
- **Accessibility**: WCAG 2.1 AA compliance for all CRUD interfaces
- **Mobile**: Touch-friendly targets (44x44px minimum) with responsive design

## Architecture Decisions

### ADR-007: Scry UI/UX Architecture Improvements

**Status**: Proposed
**Date**: 2025-08-27

### Technology Stack
- **Frontend**: Next.js 15 + React 19 (existing)
- **Styling**: Tailwind CSS v4 with CSS Grid layouts
- **Components**: shadcn/ui with DataTable for CRUD
- **Backend**: Convex mutations with soft delete pattern
- **Validation**: React Hook Form + Zod (existing patterns)

### Design Patterns
- **Architecture Pattern**: Sticky layout grid to prevent overlap
- **Data Flow**: Optimistic mutations with automatic rollback
- **Permission Model**: Creator-only with database-level enforcement
- **Delete Strategy**: Soft delete to preserve FSRS scheduling integrity

### Decision Rationale
- Sticky positioning eliminates overlap while maintaining visibility
- Soft delete preserves learning progress and enables undo
- Modal editing provides focused experience without navigation
- Route specialization clarifies user mental models

## Implementation Strategy

### Development Approach

**Phase 1: Layout System** (4 hours)
1. Convert fixed positioning to CSS Grid layout
2. Implement sticky navbar/footer with proper spacing
3. Ensure responsive alignment across breakpoints
4. Test on mobile devices for viewport issues

**Phase 2: Question CRUD** (6 hours)
1. Add Convex mutations for edit/delete with permissions
2. Create edit modal with form validation
3. Implement soft delete with `deletedAt` timestamp
4. Add bulk selection and operations
5. Create optimistic UI updates with error recovery

**Phase 3: Route Differentiation** (3 hours)
1. Refactor dashboard to focus on overview/actions
2. Enhance quizzes page with filtering/search
3. Extract shared components to reduce duplication
4. Update navigation to clarify purpose

### MVP Definition
1. Layout fixes preventing content overlap
2. Single question edit/delete with creator permissions
3. Clear visual distinction between dashboard and quizzes

### Technical Risks

- **Risk 1: FSRS Data Corruption**
  - Description: Editing questions could invalidate spaced repetition calculations
  - Mitigation: Only allow editing non-answer fields (topic, explanation)

- **Risk 2: Layout Breaking Changes**
  - Description: Switching from fixed to sticky could affect existing user workflows
  - Mitigation: Gradual rollout with feature flag, extensive mobile testing

- **Risk 3: Permission Bypass**
  - Description: Client-side checks could be circumvented
  - Mitigation: Enforce all permissions in Convex backend mutations

## Integration Requirements

### Existing System Impact
- Navbar component: Convert from fixed to sticky positioning
- Footer component: Update positioning and spacing
- Question queries: Add soft delete filtering
- Dashboard/Quizzes routes: Refactor for distinct purposes

### API Design
```typescript
// New Convex mutations
api.questions.update: Edit question (creator only)
api.questions.softDelete: Soft delete with timestamp
api.questions.restore: Restore soft-deleted questions
api.questions.bulkDelete: Delete multiple questions
```

### Data Migration
- Add `deletedAt?: number` field to questions table
- Add `isActive?: boolean` for quick filtering
- Update queries to exclude deleted questions by default

## Testing Strategy

### Unit Testing
- Permission checks for CRUD operations
- Soft delete/restore logic
- Form validation for question editing

### Integration Testing
- End-to-end CRUD flow with optimistic updates
- Layout responsiveness across devices
- Route navigation and state persistence

### End-to-End Testing
- Complete user journey: create → edit → delete → restore
- Mobile viewport handling with dynamic toolbars
- Bulk operations with large datasets

## Deployment Considerations

### Environment Requirements
- No new infrastructure required
- Existing Convex deployment handles mutations
- Client-side feature flags for gradual rollout

### Rollout Strategy
1. Deploy layout fixes (low risk, high impact)
2. Enable CRUD for beta users (medium risk)
3. Full rollout after monitoring period
4. Route changes last (user education needed)

### Monitoring & Observability
- Track CRUD operation success/failure rates
- Monitor layout shift metrics (CLS)
- User engagement with edit/delete features
- Navigation patterns between dashboard/quizzes

## Success Criteria

### Acceptance Criteria
- Zero content overlap issues across all devices
- 100% of users can edit/delete their own questions
- <5% user confusion about route purposes (survey)
- No FSRS data corruption from edits

### Performance Metrics
- CRUD operations: <500ms perceived latency
- Layout shift: CLS score <0.1
- Mobile usability: 100% touch target compliance

### User Experience Goals
- Task completion rate: >95% for question editing
- Error recovery: <3 clicks to undo mistakes
- Navigation clarity: <2 clicks to any feature

## Future Enhancements

### Post-MVP Features
- Question versioning with edit history
- Collaborative question sharing
- Advanced bulk operations (find/replace, tagging)
- Keyboard shortcuts for power users

### Scalability Roadmap
- Pagination for large question sets
- Virtual scrolling for performance
- Background sync for offline CRUD
- Real-time collaborative editing
