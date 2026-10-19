import { comingSoonMetadata, comingSoonPage } from "@/components/coming-soon";

// Placeholder until a later stage.
export const generateMetadata = comingSoonMetadata((d) => d.footer.commission);
export default comingSoonPage((d) => d.footer.commission, true);
