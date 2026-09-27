import { Hero } from "@/components/marketing/Hero";
import { DeploySection } from "@/components/marketing/DeploySection";
import { TrackingSection } from "@/components/marketing/TrackingSection";
import {
  AudienceSection,
  CtaSection,
  GallerySection,
  OpsSection,
  ProblemSection,
  RobotSection,
} from "@/components/marketing/Sections";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <DeploySection />
      <TrackingSection />
      <RobotSection />
      <AudienceSection />
      <OpsSection />
      <GallerySection />
      <CtaSection />
    </>
  );
}
