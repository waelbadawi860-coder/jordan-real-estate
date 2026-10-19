import { comingSoonMetadata, comingSoonPage } from "@/components/coming-soon";

// Placeholder until a later stage.
export const generateMetadata = comingSoonMetadata((d) => d.footer.privacy);
export default comingSoonPage((d) => d.footer.privacy, true);
