// The only file components import from.
//
//   VITE_USE_MOCK_API=false  -> the real Express API at VITE_API_BASE_URL
//   anything else, INCLUDING UNSET -> the browser-only mock
//
// Demo mode is the default so a fresh clone builds into a working site
// before the backend exists. See src/api/mockApi.js and httpApi.js.

import * as mockApi from './mockApi.js'
import * as httpApi from './httpApi.js'

export const USING_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'

const implementation = USING_MOCK_API ? mockApi : httpApi

export const {
  getProfile,
  updateProfile,
  listSubjects,
  createSubject,
  deleteSubject,
  listAnnouncements,
  parseAnnouncement,
  listDeliverables,
  updateDeliverable,
  listAlerts,
  dismissAlert,
  connectCanvas,
  disconnectCanvas,
  triggerCanvasSync,
  getSyncStatus,
} = implementation
