import RegionalLanding from "@/components/regions/RegionalLanding";
import type {
  RegionalLandingModel,
  RegionalLandingQuery,
} from "@/lib/regions/regional-landing-model";

type RegionalLandingPreviewProps = {
  model: RegionalLandingModel;
  pathname: string;
  query: RegionalLandingQuery;
};

export default function RegionalLandingPreview(
  props: RegionalLandingPreviewProps,
) {
  return <RegionalLanding {...props} mode="preview" />;
}
