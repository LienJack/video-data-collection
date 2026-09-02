import type { UiLocale } from "@egocapture/core/i18n";
import { CloudArrowUp } from "@phosphor-icons/react/dist/ssr";
import type { GuidePageContent } from "./guide-content";
import { LocalizedGuideArticle } from "./localized-guide-article";

export function ResumableUploadArticle({ locale, content }: { locale: UiLocale; content: GuidePageContent }) {
  return (
    <LocalizedGuideArticle
      id="resumable-upload"
      number="03"
      icon={<CloudArrowUp className="size-6" weight="duotone" />}
      statuses={["current", "future", "boundary"]}
      locale={locale}
      content={content.articles.upload}
      pageContent={content}
      diagram="multipart-resume"
      conclusionTone="amber"
    />
  );
}
