
-- Wiki categories for organizing pages
CREATE TABLE public.wiki_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wiki_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wiki categories"
  ON public.wiki_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage wiki categories"
  ON public.wiki_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Wiki pages
CREATE TABLE public.wiki_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  summary TEXT,
  category_id UUID REFERENCES public.wiki_categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL,
  updated_by UUID,
  is_published BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wiki_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view published wiki pages"
  ON public.wiki_pages FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_published = true);

CREATE POLICY "Admins can view all wiki pages"
  ON public.wiki_pages FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert wiki pages"
  ON public.wiki_pages FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update wiki pages"
  ON public.wiki_pages FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete wiki pages"
  ON public.wiki_pages FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_wiki_categories_updated_at
  BEFORE UPDATE ON public.wiki_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wiki_pages_updated_at
  BEFORE UPDATE ON public.wiki_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for search
CREATE INDEX idx_wiki_pages_title ON public.wiki_pages USING gin(to_tsvector('english', title));
CREATE INDEX idx_wiki_pages_tags ON public.wiki_pages USING gin(tags);
CREATE INDEX idx_wiki_pages_category ON public.wiki_pages(category_id);
