--    This file is part of WebBox.
--
--    Copyright 2011-2013 Daniel Alexander Smith
--    Copyright 2011-2013 University of Southampton
--
--    WebBox is free software: you can redistribute it and/or modify
--    it under the terms of the GNU General Public License as published by
--    the Free Software Foundation, either version 3 of the License, or
--    (at your option) any later version.
--
--    WebBox is distributed in the hope that it will be useful,
--    but WITHOUT ANY WARRANTY; without even the implied warranty of
--    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
--    GNU General Public License for more details.
--
--    You should have received a copy of the GNU General Public License
--    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

CREATE TYPE object_type AS ENUM ('resource', 'literal');
CREATE TYPE change_type AS ENUM ('add_subject', 'remove_subject', 'add_triple', 'add_predicate', 'replace_objects', 'remove_predicate');
-- 'remove_triple');


CREATE TABLE wb_strings
(
  id_string serial NOT NULL,
  string text NOT NULL,
  CONSTRAINT pk_string PRIMARY KEY (id_string),
  CONSTRAINT u_string UNIQUE (string)
)
WITH (
  OIDS=FALSE
);


CREATE TABLE wb_objects
(
  id_object serial NOT NULL,
  obj_type object_type NOT NULL,
  obj_value INTEGER NOT NULL,
  obj_lang character varying(128) NOT NULL,
  obj_datatype character varying(2048) NOT NULL,
  CONSTRAINT pk_object PRIMARY KEY (id_object),
  CONSTRAINT uidx_obj UNIQUE (obj_type, obj_value, obj_lang, obj_datatype),
  CONSTRAINT fk_obj_value FOREIGN KEY (obj_value)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);


CREATE TABLE wb_triples
(
  id_triple serial NOT NULL,
  subject integer NOT NULL,
  predicate integer NOT NULL,
  object integer,
--  object_order integer NOT NULL,
  CONSTRAINT pk_triple PRIMARY KEY (id_triple),
  CONSTRAINT fk_subject FOREIGN KEY (subject)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT fk_predicate FOREIGN KEY (predicate)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
--  CONSTRAINT fk_object FOREIGN KEY (object)
--      REFERENCES wb_objects (id_object) MATCH SIMPLE
--      ON UPDATE NO ACTION ON DELETE NO ACTION,
-- -- Removing the constraint because this is now an array - PG9.3 will allow ELEMENT constraints.
  CONSTRAINT uq_spo UNIQUE (subject, predicate, object)
)
WITH (
  OIDS=FALSE
);


CREATE TABLE wb_users
(
  username name NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  CONSTRAINT pk_user PRIMARY KEY (username)
)
WITH (
  OIDS=FALSE
);


-- Remove this in future
INSERT INTO wb_users (username, email, name) VALUES ('webbox', 'webbox@localhost', 'Webbox User');

-- Only every N versions will get a full snapshot - where N is dynamically determined
CREATE TABLE wb_triple_vers_snapshots
(
  version integer NOT NULL,
  triple integer NOT NULL,
  triple_order integer NOT NULL,
  CONSTRAINT pk_version_triple_order PRIMARY KEY (version, triple, triple_order),
  CONSTRAINT fk_triple FOREIGN KEY (triple)
      REFERENCES wb_triples (id_triple) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);


CREATE TABLE wb_latest_subjects
(
    id_subject integer NOT NULL,
    CONSTRAINT pk_subject PRIMARY KEY (id_subject),
    CONSTRAINT fk_subject FOREIGN KEY (id_subject)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
    OIDS=FALSE
);

CREATE TABLE wb_latest_vers
(
  triple integer NOT NULL,
  triple_order integer NOT NULL,
  CONSTRAINT pk_latest_triple_order PRIMARY KEY (triple, triple_order),
  CONSTRAINT fk_triple FOREIGN KEY (triple)
      REFERENCES wb_triples (id_triple) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);


CREATE TABLE wb_vers_diffs
(
  id_diff serial NOT NULL,
  version INTEGER NOT NULL,
  diff_type change_type NOT NULL,
  subject INTEGER NOT NULL,
  predicate INTEGER,
  object INTEGER,
  object_order INTEGER,
  CONSTRAINT pk_diff PRIMARY KEY (id_diff),
  CONSTRAINT fk_subject FOREIGN KEY (subject)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT fk_predicate FOREIGN KEY (predicate)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
) WITH (
    OIDS=FALSE
);


CREATE TABLE wb_versions
(
  version integer NOT NULL,
  updated timestamp with time zone NOT NULL,
  username name NOT NULL,
  appid text NOT NULL,
  clientip inet NOT NULL,
  CONSTRAINT pk_version PRIMARY KEY (version)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE wb_files
(
  id_file serial NOT NULL,
  data oid NOT NULL,
  version integer NOT NULL,
  file_id text NOT NULL,
  contenttype text NOT NULL,
  CONSTRAINT pk_id_files PRIMARY KEY (id_file)
)
WITH (
  OIDS=FALSE
);


