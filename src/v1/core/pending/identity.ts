import type {
	PendingLemmaIdentity,
	PendingLemmaId,
	PendingLemmaRef,
} from "../../dto";
import type { SupportedLanguage } from "../../dumling";

export function derivePendingLemmaId<L extends SupportedLanguage>(
	identity: PendingLemmaIdentity<L>,
): PendingLemmaId<L> {
	return [
		"pending",
		"v1",
		encodeURIComponent(identity.language),
		encodeURIComponent(identity.canonicalLemma),
		encodeURIComponent(identity.lemmaKind),
		encodeURIComponent(identity.lemmaSubKind),
	].join(":") as PendingLemmaId<L>;
}

export function makePendingLemmaRef<L extends SupportedLanguage>(
	identity: PendingLemmaIdentity<L>,
): PendingLemmaRef<L> {
	return {
		...identity,
		pendingId: derivePendingLemmaId(identity),
	};
}

