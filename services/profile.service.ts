import { supabase } from "../config";
import { ProfileData } from "../index.d";

export class ProfileService {
  static async getProfile(userId: string): Promise<ProfileData> {
    const { data, error } = await supabase
      .from("profiles")
      .select("credit_balance, wallet")
      .eq("id", userId)
      .single();

    if (error || !data) throw new Error(`Profile fetch failed: ${error?.message}`);
    return data;
  }
}