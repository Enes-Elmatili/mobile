/**
 * FIXED auth components — shared primitives for the auth flow.
 * Welcome screen lives separately but uses the same tokens for consistency.
 */
export { AuthScreen } from "./AuthScreen";
export { AuthHeadline } from "./AuthHeadline";
export { AuthCTA } from "./AuthCTA";
export { AuthBackButton } from "./AuthBackButton";
export { AuthInput } from "./AuthInput";
export { AuthLink } from "./AuthLink";
export { AuthPhoneInput } from "./AuthPhoneInput";
export { AuthAddressAutocomplete } from "./AuthAddressAutocomplete";
export type { ParsedAddress } from "./AuthAddressAutocomplete";
export { authT, alpha, invertedGradient, standardGradient } from "./tokens";
