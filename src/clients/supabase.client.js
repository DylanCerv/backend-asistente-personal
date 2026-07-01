const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config");

let serviceClient = null;
let anonClient = null;

function getServiceClient() {
  if (!serviceClient) {
    serviceClient = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serviceClient;
}

function getAnonClient() {
  if (!anonClient) {
    const anonKey = env.supabaseAnonKey();
    if (!anonKey) {
      return null;
    }
    anonClient = createClient(env.supabaseUrl(), anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return anonClient;
}

module.exports = {
  getServiceClient,
  getAnonClient,
};
