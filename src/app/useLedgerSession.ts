import { useState } from "react";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Ledger } from "../ledger";

type ActiveSession =
  | { kind: "closed"; revision: number }
  | { kind: "active"; ledger: Ledger; name: string; revision: number };

export function useLedgerSession({ onSaved }: { onSaved(): void }) {
  const [active, setActive] = useState<ActiveSession>({
    kind: "closed",
    revision: 0,
  });
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["book", active.revision],
    queryFn:
      active.kind === "active" ? () => active.ledger.snapshot() : skipToken,
  });
  const mutation = useMutation({
    mutationFn: async (operation: () => void | Promise<void>) => operation(),
    onSuccess: async () => {
      onSaved();
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["book"] });
    },
    onError: (error) => setError(error.message),
  });
  function activate(next: { ledger: Ledger; name: string }) {
    setActive((previous) => ({
      kind: "active",
      ...next,
      revision: previous.revision + 1,
    }));
  }
  return { active, activate, data: query.data, mutation, error, setError };
}
