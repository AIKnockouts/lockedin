-- LockedIn Initial Schema

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now()
);

-- Communities table
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  habit_description text NOT NULL,
  stake_amount integer NOT NULL DEFAULT 5,
  duration_days integer NOT NULL DEFAULT 30,
  max_failures integer NOT NULL DEFAULT 1,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  submission_start time NOT NULL DEFAULT '05:00',
  submission_end time NOT NULL DEFAULT '23:00',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Community members table
CREATE TABLE IF NOT EXISTS public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake_paid boolean NOT NULL DEFAULT false,
  total_failures integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  forfeited boolean NOT NULL DEFAULT false,
  grace_used boolean NOT NULL DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- Daily submissions table
CREATE TABLE IF NOT EXISTS public.daily_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  image_url text,
  image_hash text,
  ai_result text CHECK (ai_result IN ('YES', 'NO', 'UNCERTAIN')),
  confidence float CHECK (confidence >= 0 AND confidence <= 1),
  final_status text CHECK (final_status IN ('SUCCESS', 'FAILURE', 'PENDING')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(community_id, user_id, date)
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =========================================
-- Row Level Security
-- =========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, only update own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Communities: public communities readable by all, private by members
CREATE POLICY "Public communities viewable by all" ON public.communities FOR SELECT USING (
  visibility = 'public' OR
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.community_members WHERE community_id = communities.id AND user_id = auth.uid())
);
CREATE POLICY "Authenticated users can create communities" ON public.communities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creators can update communities" ON public.communities FOR UPDATE USING (created_by = auth.uid());

-- Community members: members of that community can view
CREATE POLICY "Members can view community membership" ON public.community_members FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = community_members.community_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Authenticated users can join public communities" ON public.community_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily submissions: community members can view
CREATE POLICY "Community members can view submissions" ON public.daily_submissions FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.community_members WHERE community_id = daily_submissions.community_id AND user_id = auth.uid())
);
CREATE POLICY "Members can insert own submissions" ON public.daily_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Messages: community members can read and write
CREATE POLICY "Community members can view messages" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.community_members WHERE community_id = messages.community_id AND user_id = auth.uid())
);
CREATE POLICY "Community members can send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM public.community_members WHERE community_id = messages.community_id AND user_id = auth.uid())
);

-- =========================================
-- Auto-create profile on signup
-- =========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================
-- Storage bucket (run separately)
-- =========================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', true);
-- CREATE POLICY "Public read" ON storage.objects FOR SELECT USING (bucket_id = 'submissions');
-- CREATE POLICY "Auth upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'submissions' AND auth.uid() IS NOT NULL);
