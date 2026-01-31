import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ВАШ-ПРОЕКТ.supabase.co';
const SUPABASE_ANON_KEY = 'ВАШ-АНОНИМНЫЙ-КЛЮЧ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
