import type { UiLocale } from "@egocapture/core/i18n";
import { Broadcast } from "@phosphor-icons/react/dist/ssr";
import type { GuidePageContent } from "./guide-content";
import { LocalizedGuideArticle } from "./localized-guide-article";

export function LiveCaptureArticle({ locale, content }: { locale: UiLocale; content: GuidePageContent }) {
  return (
    <LocalizedGuideArticle
      id="live-capture"
      number="04"
      icon={<Broadcast className="size-6" weight="duotone" />}
      statuses={["future", "boundary"]}
      locale={locale}
      content={content.articles.live}
      pageContent={content}
      diagram="live-recording"
      conclusionTone="violet"
    />
  );
}
