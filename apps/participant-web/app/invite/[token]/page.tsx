import Link from "next/link";
import { Card } from "@egocapture/ui/components/card";
import { AcceptInvitationForm } from "@/app/invite/[token]/accept-form";
import { openInvitation } from "@egocapture/core/server/services/participants";

export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await openInvitation(token);
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-lg p-7 sm:p-10">
        <p className="page-kicker">Participant activation</p>
        <h1 className="page-title text-[clamp(2.5rem,7vw,4rem)]">{valid ? "确认参与研究" : "邀请无效或已过期"}</h1>
        {valid ? (
          <>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">确认接受后，邀请会立即失效，并进入只属于你的 Participant 工作区。</p>
            <AcceptInvitationForm token={token} />
          </>
        ) : (
          <div className="mt-8">
            <p className="text-sm leading-7 text-[var(--muted)]">请联系管理员重新生成邀请。为保护账号，系统不会说明 Token 是否存在。</p>
            <Link href="/login" className="mt-6 inline-block border-b-2 border-[var(--signal)] pb-1 font-semibold">返回登录</Link>
          </div>
        )}
      </Card>
    </main>
  );
}
