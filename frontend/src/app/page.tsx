import { permanentRedirect } from "next/navigation";

export default function IndexPage() {
  permanentRedirect("/home");
}
