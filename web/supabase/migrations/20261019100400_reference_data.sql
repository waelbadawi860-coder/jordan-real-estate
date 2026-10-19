-- =============================================================================
-- Starting data. All of it is editable later from the admin dashboard.
-- =============================================================================

insert into public.site_settings (key, value, is_public, description) values
  ('site_name_ar',              '"عقار"',  true,  'Site name in Arabic (placeholder until the brand is chosen)'),
  ('site_name_en',              '"Aqar"',  true,  'Site name in English (placeholder until the brand is chosen)'),
  ('contact_email',             'null',    true,  'Public contact email'),
  ('listing_expiry_days',       '30',      true,  'Days a published listing stays live before expiring'),
  ('renewal_window_days',       '7',       true,  'Days before expiry when the seller may renew'),
  ('max_new_listings_per_24h',  '3',       true,  'New listings a user may create per 24 hours'),
  ('max_images_per_listing',    '20',      true,  'Maximum photos per listing'),
  ('min_images_per_listing',    '1',       true,  'Photos required before submitting a listing'),
  ('image_max_dimension_px',    '1600',    true,  'Longest side of uploaded photos after compression'),
  ('watermark_enabled',         'false',   true,  'Add the site watermark to public photos'),
  ('require_listing_approval',  'true',    true,  'New and edited listings need admin approval'),
  ('max_reports_per_24h',       '10',      false, 'Reports a user may submit per 24 hours'),
  ('commission_enabled',        'false',   true,  'Commission agreement and tracking (off until legal review)');

insert into public.property_types (slug, name_ar, name_en, has_bedrooms, sort_order) values
  ('apartment',           'شقة',          'Apartment',           true,  10),
  ('villa',               'فيلا',         'Villa',               true,  20),
  ('house',               'بيت مستقل',    'House',               true,  30),
  ('residential-land',    'أرض سكنية',    'Residential land',    false, 40),
  ('commercial-property', 'عقار تجاري',   'Commercial property', false, 50),
  ('commercial-land',     'أرض تجارية',   'Commercial land',     false, 60),
  ('office',              'مكتب',         'Office',              false, 70),
  ('shop',                'محل تجاري',    'Shop',                false, 80),
  ('building',            'عمارة',        'Building',            false, 90),
  ('other',               'أخرى',         'Other',               false, 100);

insert into public.cities (slug, name_ar, name_en, sort_order) values
  ('amman',   'عمّان',   'Amman',   1),
  ('zarqa',   'الزرقاء', 'Zarqa',   10),
  ('irbid',   'إربد',    'Irbid',   20),
  ('aqaba',   'العقبة',  'Aqaba',   30),
  ('salt',    'السلط',   'Salt',    40),
  ('madaba',  'مادبا',   'Madaba',  50),
  ('jerash',  'جرش',     'Jerash',  60),
  ('ajloun',  'عجلون',   'Ajloun',  70),
  ('karak',   'الكرك',   'Karak',   80),
  ('mafraq',  'المفرق',  'Mafraq',  90),
  ('tafilah', 'الطفيلة', 'Tafilah', 100),
  ('maan',    'معان',    'Ma''an',  110);

insert into public.neighborhoods (city_id, slug, name_ar, name_en, sort_order)
select c.id, n.slug, n.name_ar, n.name_en, n.sort_order
from public.cities c
cross join (values
  ('abdoun',              'عبدون',              'Abdoun',              10),
  ('khalda',              'خلدا',               'Khalda',              20),
  ('dabouq',              'دابوق',              'Dabouq',              30),
  ('sweifieh',            'الصويفية',           'Sweifieh',            40),
  ('jabal-amman',         'جبل عمّان',          'Jabal Amman',         50),
  ('tla-al-ali',          'تلاع العلي',         'Tla'' Al-Ali',        60),
  ('shmeisani',           'الشميساني',          'Shmeisani',           70),
  ('rabieh',              'الرابية',            'Al-Rabiah',           80),
  ('um-uthaina',          'أم أذينة',           'Um Uthaina',          90),
  ('deir-ghbar',          'دير غبار',           'Deir Ghbar',          100),
  ('jandaweel',           'الجندويل',           'Al-Jandaweel',        110),
  ('um-al-summaq',        'أم السماق',          'Um Al-Summaq',        120),
  ('kursi',               'الكرسي',             'Al-Kursi',            130),
  ('gardens',             'الجاردنز',           'Gardens',             140),
  ('abdali',              'العبدلي',            'Abdali',              150),
  ('weibdeh',             'جبل اللويبدة',       'Jabal Al-Weibdeh',    160),
  ('jabal-al-hussein',    'جبل الحسين',         'Jabal Al-Hussein',    170),
  ('jubeiha',             'الجبيهة',            'Jubeiha',             180),
  ('shafa-badran',        'شفا بدران',          'Shafa Badran',        190),
  ('abu-nseir',           'أبو نصير',           'Abu Nseir',           200),
  ('sweileh',             'صويلح',              'Sweileh',             210),
  ('tabarbour',           'طبربور',             'Tabarbour',           220),
  ('marj-al-hamam',       'مرج الحمام',         'Marj Al-Hamam',       230),
  ('wadi-al-seer',        'وادي السير',         'Wadi Al-Seer',        240),
  ('bayader',             'البيادر',            'Al-Bayader',          250),
  ('dahiet-al-rasheed',   'ضاحية الرشيد',       'Dahiet Al-Rasheed',   260),
  ('dahiet-al-amir-rashed', 'ضاحية الأمير راشد', 'Dahiet Al-Amir Rashed', 270),
  ('rawabi',              'الروابي',            'Al-Rawabi',           280),
  ('arjan',               'عرجان',              'Arjan',               290),
  ('medina-riyadiya',     'المدينة الرياضية',   'Sports City',         300),
  ('tareq',               'طارق',               'Tareq',               310),
  ('yasmeen',             'الياسمين',           'Al-Yasmeen',          320),
  ('muqabalain',          'المقابلين',          'Al-Muqabalain',       330),
  ('abu-alanda',          'أبو علندا',          'Abu Alanda',          340),
  ('ashrafieh',           'الأشرفية',           'Al-Ashrafieh',        350),
  ('hashmi',              'الهاشمي',            'Al-Hashmi',           360),
  ('marka',               'ماركا',              'Marka',               370),
  ('qwaismeh',            'القويسمة',           'Al-Qwaismeh',         380),
  ('naour',               'ناعور',              'Naour',               390),
  ('badr-jadida',         'بدر الجديدة',        'Badr Al-Jadida',      400)
) as n(slug, name_ar, name_en, sort_order)
where c.slug = 'amman';
