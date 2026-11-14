BEGIN;
CREATE TABLE public.push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id uuid NOT NULL REFERENCES public.members(id),
 endpoint text NOT NULL UNIQUE CHECK(length(endpoint) BETWEEN 1 AND 2048),
 p256dh text NOT NULL CHECK(length(p256dh) BETWEEN 80 AND 100),auth text NOT NULL CHECK(length(auth) BETWEEN 20 AND 30),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_member_idx ON public.push_subscriptions(member_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.push_subscriptions TO service_role;
CREATE OR REPLACE FUNCTION public.register_member_push(p_member_id uuid,p_endpoint text,p_p256dh text,p_auth text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM id FROM public.members WHERE id=p_member_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member is inactive'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.push_subscriptions WHERE endpoint=p_endpoint AND member_id=p_member_id) AND (SELECT count(*) FROM public.push_subscriptions WHERE member_id=p_member_id)>=10 THEN RAISE EXCEPTION 'Too many devices'; END IF;
 INSERT INTO public.push_subscriptions(member_id,endpoint,p256dh,auth) VALUES(p_member_id,p_endpoint,p_p256dh,p_auth)
 ON CONFLICT(endpoint) DO UPDATE SET member_id=p_member_id,p256dh=p_p256dh,auth=p_auth,updated_at=now() RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.register_member_push(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_member_push(uuid,text,text,text) TO service_role;
CREATE TABLE public.reward_push_outbox (
 gift_id uuid PRIMARY KEY REFERENCES public.reward_gifts(id),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','skipped','failed')),
 attempts integer NOT NULL DEFAULT 0,sent_subscription_ids uuid[] NOT NULL DEFAULT '{}',
 next_attempt_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),last_error text
);
ALTER TABLE public.reward_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reward_push_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.reward_push_outbox TO service_role;
CREATE OR REPLACE FUNCTION public.queue_reward_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO public.reward_push_outbox(gift_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.queue_reward_push() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER queue_reward_push AFTER INSERT ON public.reward_gifts FOR EACH ROW EXECUTE FUNCTION public.queue_reward_push();
CREATE OR REPLACE FUNCTION public.claim_reward_push(p_gift_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 SELECT gift_id INTO v_id FROM public.reward_push_outbox
 WHERE (p_gift_id IS NULL OR gift_id=p_gift_id) AND attempts<4 AND next_attempt_at<=now()
 AND (status='pending' OR (status='processing' AND updated_at<now()-interval '5 minutes'))
 ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF v_id IS NULL THEN RETURN NULL;END IF;
 UPDATE public.reward_push_outbox SET status='processing',attempts=attempts+1,updated_at=now() WHERE gift_id=v_id;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.note_reward_push_delivery(p_gift_id uuid,p_subscription_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.reward_push_outbox SET sent_subscription_ids=array_append(sent_subscription_ids,p_subscription_id),updated_at=now()
 WHERE gift_id=p_gift_id AND NOT(p_subscription_id=ANY(sent_subscription_ids));
$$;
REVOKE ALL ON FUNCTION public.claim_reward_push(uuid),public.note_reward_push_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reward_push(uuid),public.note_reward_push_delivery(uuid,uuid) TO service_role;
COMMIT;
