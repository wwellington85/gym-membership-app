import { signQrToken, verifyQrToken } from "@/lib/qr/token";
const prefix = "TBR-REWARD:";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function signRewardToken(
  memberId: string,
  giftId: string,
  secret: string,
) {
  const iat = Math.floor(Date.now() / 1000),
    exp = iat + 90;
  return {
    token:
      prefix +
      signQrToken(
        { mid: memberId, jti: giftId, iat, exp },
        secret + "|reward-gift-v1",
      ),
    exp,
  };
}
export function verifyRewardToken(token: string, secret: string) {
  if (!token.startsWith(prefix)) return null;
  const result = verifyQrToken(
    token.slice(prefix.length),
    secret + "|reward-gift-v1",
  );
  if (!result.ok) return null;
  const c = result.claims,
    now = Math.floor(Date.now() / 1000);
  if (
    !uuid.test(c.mid) ||
    !uuid.test(c.jti) ||
    !Number.isInteger(c.iat) ||
    !Number.isInteger(c.exp) ||
    c.iat > now ||
    c.exp <= now ||
    c.exp - c.iat !== 90
  )
    return null;
  return { memberId: c.mid, giftId: c.jti };
}
