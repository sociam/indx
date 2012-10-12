
-- run this script as a superuser (e.g., as user postgres)

CREATE ROLE webbox LOGIN
  PASSWORD 'foobar'
  NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;

CREATE DATABASE webbox
  WITH ENCODING='UTF8'
       OWNER=webbox
       CONNECTION LIMIT=-1;

