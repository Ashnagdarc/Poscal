import { Calculator } from "./Calculator";
import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const ConnectedCalculator = () => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();
  const { isPaid } = useSubscription();
  return <Calculator user={user} activeJournalId={activeJournalId} isPaid={isPaid} />;
};
