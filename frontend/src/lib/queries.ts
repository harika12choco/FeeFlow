import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  DashboardStats,
  FilterOptions,
  RefundPolicy,
  RefundRecord,
  RefundResult,
  ReminderOut,
  RiskFlag,
  StudentDetail,
  StudentSummary,
} from "./types";

/* ------------------------------------------------------------- Dashboard */

export function useDashboard(filters: { centre?: string; batch?: string; program?: string }) {
  return useQuery({
    queryKey: ["dashboard", filters],
    queryFn: async () => {
      const r = await api.get<DashboardStats>("/dashboard/stats", { params: cleaned(filters) });
      return r.data;
    },
  });
}

/* -------------------------------------------------------------- Students */

export function useStudents(filters: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ["students", filters],
    queryFn: async () => {
      const r = await api.get<StudentSummary[]>("/students", { params: cleaned(filters) });
      return r.data;
    },
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: ["filters"],
    queryFn: async () => (await api.get<FilterOptions>("/students/filters")).data,
  });
}

export function useStudent(id: number | string | undefined) {
  return useQuery({
    queryKey: ["student", id],
    enabled: id !== undefined,
    queryFn: async () => (await api.get<StudentDetail>(`/students/${id}`)).data,
  });
}

export function useParentPortal() {
  return useQuery({
    queryKey: ["parent-portal"],
    queryFn: async () => (await api.get<StudentDetail>("/parent/portal")).data,
  });
}

/* -------------------------------------------------------------- Reminders */

export function useReminders(filters: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ["reminders", filters],
    queryFn: async () =>
      (await api.get<ReminderOut[]>("/reminders", { params: cleaned(filters) })).data,
  });
}

export function useReminderActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reminders"] });
    qc.invalidateQueries({ queryKey: ["student"] });
  };
  const generate = useMutation({
    mutationFn: async (body: { student_id?: number; language?: string }) =>
      (await api.post("/reminders/generate", body)).data,
    onSuccess: invalidate,
  });
  const dispatch = useMutation({
    mutationFn: async (body: { as_of?: string } = {}) =>
      (await api.post("/reminders/dispatch", body)).data,
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: async (id: number) => (await api.post(`/reminders/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
  return { generate, dispatch, cancel };
}

/* ---------------------------------------------------------------- Refunds */

export function useRefundPolicies() {
  return useQuery({
    queryKey: ["refund-policies"],
    queryFn: async () => (await api.get<RefundPolicy[]>("/refunds/policies")).data,
  });
}

export function useRefundList() {
  return useQuery({
    queryKey: ["refunds"],
    queryFn: async () => (await api.get<RefundRecord[]>("/refunds")).data,
  });
}

export function useRefundActions() {
  const qc = useQueryClient();
  const calculate = useMutation({
    mutationFn: async (body: { student_id: number; policy_key: string; as_of?: string }) =>
      (await api.post<RefundResult>("/refunds/calculate", body)).data,
  });
  const create = useMutation({
    mutationFn: async (body: {
      student_id: number;
      policy_key: string;
      reason: string;
      as_of?: string;
    }) => (await api.post<RefundRecord>("/refunds", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refunds"] }),
  });
  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await api.post(`/refunds/${id}/decision`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refunds"] }),
  });
  return { calculate, create, decide };
}

/* ------------------------------------------------------------------- Risk */

export function useRiskFlags(filters: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ["risk-flags", filters],
    queryFn: async () => (await api.get<RiskFlag[]>("/risk/flags", { params: cleaned(filters) })).data,
  });
}

export function useRiskActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["risk-flags"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const assess = useMutation({
    mutationFn: async (body: { student_id: number; use_ai?: boolean }) =>
      (await api.post("/risk/assess", body)).data,
    onSuccess: invalidate,
  });
  const assessAll = useMutation({
    mutationFn: async () => (await api.post("/risk/assess-all")).data,
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await api.post(`/risk/flags/${id}/status`, { status })).data,
    onSuccess: invalidate,
  });
  return { assess, assessAll, setStatus };
}

/* ----------------------------------------------------------------- utils */

function cleaned(obj: Record<string, string | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) if (v) out[k] = v;
  return out;
}
