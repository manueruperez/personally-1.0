-- Schema para GoTrue (Supabase Auth standalone).
-- GoTrue corre sus propias migrations al arrancar, pero espera que el
-- schema `auth` exista (search_path=auth en su DATABASE_URL).
-- El schema `public` queda para Prisma (tablas de negocio).
CREATE SCHEMA IF NOT EXISTS auth;
