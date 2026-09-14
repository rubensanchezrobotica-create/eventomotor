import V2InteriorShell, {
  type V2InteriorShellProps,
} from "./V2InteriorShell";

type V2PreviewShellProps = Omit<V2InteriorShellProps, "navigationMode">;

export default function V2PreviewShell(props: V2PreviewShellProps) {
  return <V2InteriorShell {...props} navigationMode="preview" />;
}
