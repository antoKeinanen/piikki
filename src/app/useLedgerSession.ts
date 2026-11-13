import { useState } from "react";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Ledger } from "../ledger";
import type { OpenedDatabase, Protection } from "../persistence/database-file";

type ActiveSession =
  | { kind: "closed"; revision: number }
  | {
      kind: "active";
      ledger: Ledger;
      name: string;
      protection?: Protection;
      revision: number;
    };

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
  function activate(next: OpenedDatabase) {
    setActive((previous) => ({
      kind: "active",
      ...next,
      revision: previous.revision + 1,
    }));
  }
  /** Forgets the open database so nothing of it stays readable in the app. */
  function close() {
    if (active.kind === "active") active.ledger.close();
    queryClient.removeQueries({ queryKey: ["book"] });
    setActive((previous) => ({ kind: "closed", revision: previous.revision + 1 }));
    setError("");
  }
  return { active, activate, close, data: query.data, mutation, error, setError };
}
