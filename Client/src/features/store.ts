import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Session } from '@/lib/types';
import { useDispatch, useSelector } from 'react-redux';
const auth = createSlice({
  name: 'auth',
  initialState: { session: null as Session | null },
  reducers: {
    setSession: (state, action: PayloadAction<Session | null>) => {
      state.session = action.payload;
    },
  },
});
const ui = createSlice({
  name: 'ui',
  initialState: { sidebarOpen: false, commandOpen: false, theme: 'light' as 'light' | 'dark' },
  reducers: {
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setCommandOpen: (state, action: PayloadAction<boolean>) => {
      state.commandOpen = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
  },
});
const org = createSlice({
  name: 'org',
  initialState: { id: null as string | null },
  reducers: {
    setOrganization: (state, action: PayloadAction<string | null>) => {
      state.id = action.payload;
    },
  },
});
export const { setSession } = auth.actions;
export const { setCommandOpen, setSidebarOpen, setTheme } = ui.actions;
export const { setOrganization } = org.actions;
export const makeStore = () =>
  configureStore({ reducer: { auth: auth.reducer, ui: ui.reducer, org: org.reducer } });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export const useAppDispatch = useDispatch.withTypes<AppStore['dispatch']>();
export const useAppSelector = useSelector.withTypes<RootState>();
