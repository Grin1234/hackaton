# Missing Features Analysis

Based on the README.md and ai-code-review-assistant.plan.md, here are the features that need to be added to complete the application:

## ✅ Already Implemented

1. **Electron Desktop App** - Main process, window management, IPC communication
2. **File Watcher Service** - Monitors workspace directories for file changes
3. **Workspace Management** - Add/remove workspaces, auto-detection
4. **Review Queue System** - Background processing of reviews
5. **Pre-commit Git Hook** - Integration with git hooks to block commits with critical issues
6. **Review Panel UI** - Display reviews with findings
7. **File Tree Component** - Shows workspace files with status indicators
8. **Code Viewer** - Syntax highlighting with line highlighting
9. **Automatic Fixes** - Backend support for applying fixes (IPC handlers exist)
10. **Effort Estimation** - Calculated and stored in findings
11. **Token Usage Tracking** - Stored in Review model (tokenUsage field)
12. **Incremental Review Flag** - Set when updating existing reviews
13. **Notification System** - Desktop notifications for critical/high issues
14. **Comment Schema** - Database schema exists for comments/replies

## ❌ Missing Features

### 1. **Settings Panel/Window** (Phase 5, item 26; Phase 8)
   - **Status**: Not implemented
   - **Location**: Need to create `frontend/src/pages/Settings.jsx`
   - **Features Needed**:
     - Ollama model selection
     - Auto-review toggle
     - Notification preferences
     - Workspace-specific settings
     - Auto-start option
     - File watching preferences
   - **IPC**: Need to add `settings:*` handlers in `electron/main.js`

### 2. **System Tray Icon** (Phase 8, items 39-40)
   - **Status**: Not implemented
   - **Location**: Need to add to `electron/main.js`
   - **Features Needed**:
     - Tray icon with menu
     - Minimize to tray option
     - Quick access to main window
     - Show/hide window
     - Quit option
   - **Dependencies**: `electron` (already installed)

### 3. **Diff Viewer Component** (Phase 5, item 24)
   - **Status**: Not implemented
   - **Location**: Need to create `frontend/src/components/DiffViewer.jsx`
   - **Features Needed**:
     - Side-by-side comparison (original vs fixed code)
     - Line-by-line diff highlighting
     - Show which lines were changed
     - Accept/reject changes before applying
   - **Integration**: Add to ReviewPanel when fix is applied

### 4. **Apply/Reject Fix Buttons in UI** (Phase 7, items 34-35)
   - **Status**: Backend exists, UI missing
   - **Location**: `frontend/src/components/ReviewPanel.jsx`
   - **Current State**: Fix application logic exists in `electron/main.js` but no UI buttons
   - **Features Needed**:
     - "Apply Fix" button for each finding
     - "Reject Fix" button for each finding
     - Confirmation dialog before applying
     - Visual feedback after apply/reject
     - Show effort estimation on buttons
   - **IPC**: Already exists (`review:applyFix`, `review:rejectFix`)

### 5. **Comment/Reply UI Integration** (Phase 7, item 38)
   - **Status**: Schema exists, UI not integrated
   - **Location**: `frontend/src/components/ReviewPanel.jsx`
   - **Current State**: `CommentThread.jsx` exists but not used in ReviewPanel
   - **Features Needed**:
     - Add comment button for each finding
     - Display comments inline with findings
     - Reply to comments
     - Resolve/reject comments
     - Comment input form
   - **IPC**: Need to add `comment:*` handlers in `electron/main.js`

### 6. **Review History Per File** (Phase 7, item 37)
   - **Status**: Not implemented
   - **Location**: `frontend/src/components/ReviewPanel.jsx`
   - **Features Needed**:
     - Dropdown/tabs to view past reviews
     - Show review date/time
     - Compare findings across reviews
     - Show which findings were fixed
     - Timeline view of review changes
   - **Backend**: Need to store review history (currently overwrites)

### 7. **Cost/Token Usage Display** (Optimization section)
   - **Status**: Tracked but not displayed
   - **Location**: `frontend/src/components/ReviewPanel.jsx`
   - **Current State**: Token usage stored in `review.tokenUsage` but not shown
   - **Features Needed**:
     - Display token usage per review
     - Show prompt tokens, completion tokens, total
     - Cost estimation (if applicable)
     - Usage statistics dashboard
   - **Display**: Add to ReviewPanel header or summary section

### 8. **Auto-start Option** (Phase 8, item 41)
   - **Status**: Not implemented
   - **Location**: `electron/main.js` + Settings UI
   - **Features Needed**:
     - System auto-start on boot
     - Platform-specific implementation (Linux: systemd user service, .desktop file)
     - Toggle in Settings
   - **Implementation**: Use `electron-updater` or platform-specific auto-start libraries

### 9. **Effort Estimation Display** (Already calculated, need UI)
   - **Status**: Calculated but not prominently displayed
   - **Location**: `frontend/src/components/ReviewPanel.jsx`
   - **Current State**: `effortEstimation` field exists in findings
   - **Features Needed**:
     - Show effort badge on findings
     - Filter by effort level
     - Sort by effort
     - Visual indicator (trivial/low/medium/high)

### 10. **Incremental Review Git Diff Integration** (Phase 7, item 33)
   - **Status**: Flag exists but not fully implemented
   - **Location**: `electron/services/reviewQueue.js`, `backend/src/services/ollamaService.js`
   - **Current State**: `incremental` flag is set but git diff parsing not fully utilized
   - **Features Needed**:
     - Parse git diff to get only changed lines
     - Pass changed lines to Ollama (not full file)
     - Show only changed lines in review
     - Better performance for large files
   - **Code**: `codeParser.js` has `parseGitDiff` function but needs integration

### 11. **Workspace Settings** (Phase 3, item 13)
   - **Status**: Basic workspace management exists, settings not implemented
   - **Location**: `electron/models/Workspace.js`, `frontend/src/components/WorkspaceManager.jsx`
   - **Features Needed**:
     - Per-workspace auto-review toggle
     - Per-workspace notification preferences
     - Per-workspace file patterns to watch
     - Per-workspace git hook settings
   - **Model**: Extend Workspace model with settings object

### 12. **Review History Storage** (Required for item 6)
   - **Status**: Not implemented
   - **Location**: `electron/models/Review.js`
   - **Current State**: Reviews overwrite existing ones (unique filePath)
   - **Features Needed**:
     - Store review history (multiple reviews per file)
     - Version reviews with timestamps
     - Keep last N reviews per file
     - Archive old reviews
   - **Change**: Remove `unique: true` from filePath, add versioning

## Priority Recommendations

### High Priority (Core Features)
1. **Apply/Reject Fix Buttons** - Users can't interact with fixes
2. **Diff Viewer** - Critical for reviewing fixes before applying
3. **Comment/Reply UI** - Required for collaboration
4. **Review History** - Essential for tracking changes

### Medium Priority (UX Improvements)
5. **Settings Panel** - User customization
6. **Cost/Token Display** - Visibility into usage
7. **Effort Estimation Display** - Better prioritization
8. **System Tray** - Better desktop integration

### Low Priority (Polish)
9. **Auto-start** - Nice to have
10. **Incremental Review Enhancement** - Performance optimization
11. **Workspace Settings** - Advanced configuration

## Implementation Notes

- Most backend functionality exists, focus on UI components
- IPC handlers mostly complete, may need additions for comments
- Database schema supports most features, may need review history changes
- Electron main process needs system tray integration

