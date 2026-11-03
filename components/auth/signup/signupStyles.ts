// components/auth/signup/signupStyles.ts — styles partagés entre les phases du signup
import { StyleSheet } from "react-native";
import { FONTS } from "@/hooks/use-app-theme";

export const ss = StyleSheet.create({
  body: {
    paddingTop: 14,
    gap: 12,
  },

  form: {
    gap: 10,
  },

  // CGU / note de bas de phase
  cguRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingTop: 2,
  },
  cguText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
  },
  cguLink: {
    textDecorationLine: "underline",
  },
});
