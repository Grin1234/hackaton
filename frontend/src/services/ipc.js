// IPC service for Electron API
export const electronAPI = window.electronAPI || {
  workspace: {
    add: async () => ({ error: 'Not in Electron' }),
    remove: async () => ({ error: 'Not in Electron' }),
    list: async () => [],
    getStatus: async () => null,
  },
  file: {
    getReview: async () => null,
    getAllReviews: async () => [],
    onChanged: () => {},
    onReviewed: () => {},
  },
  review: {
    applyFix: async () => ({ success: false }),
    rejectFix: async () => ({ success: false }),
  },
  git: {
    installHook: async () => ({ success: false }),
    checkStaged: async () => [],
    commit: async () => ({ success: false }),
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  },
};

