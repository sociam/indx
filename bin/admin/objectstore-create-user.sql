
-- run this script as a superuser (e.g., as user postgres)

CREATE ROLE indx LOGIN
  PASSWORD 'foobar'
  NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;

CREATE DATABASE indx
  WITH ENCODING='UTF8'
       OWNER=indx
       CONNECTION LIMIT=-1;

