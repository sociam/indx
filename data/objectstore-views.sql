--    Copyright (C) 2011-2013 University of Southampton
--    Copyright (C) 2011-2013 Daniel Alexander Smith
--    Copyright (C) 2011-2013 Max Van Kleek
--    Copyright (C) 2011-2013 Nigel R. Shadbolt
--
--    This program is free software: you can redistribute it and/or modify
--    it under the terms of the GNU Affero General Public License, version 3,
--    as published by the Free Software Foundation.
--
--    This program is distributed in the hope that it will be useful,
--    but WITHOUT ANY WARRANTY; without even the implied warranty of
--    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
--    GNU Affero General Public License for more details.
--
--    You should have received a copy of the GNU Affero General Public License
--    along with this program.  If not, see <http://www.gnu.org/licenses/>.

CREATE OR REPLACE VIEW wb_v_latest_version AS 
 SELECT max(wb_versions.version) AS latest_version
   FROM wb_versions;

CREATE OR REPLACE VIEW wb_v_latest_triples AS 
 SELECT wb_latest_vers.triple_order, j_subject.string AS subject, 
    j_predicate.string AS predicate, j_object.string AS obj_value, 
    wb_objects.obj_type, wb_objects.obj_lang, wb_objects.obj_datatype
   FROM wb_latest_vers
   JOIN wb_triples ON wb_triples.id_triple = wb_latest_vers.triple
   JOIN wb_objects ON wb_objects.id_object = wb_triples.object
   JOIN wb_strings j_subject ON j_subject.id_string = wb_triples.subject
   JOIN wb_strings j_predicate ON j_predicate.id_string = wb_triples.predicate
   JOIN wb_strings j_object ON j_object.id_string = wb_objects.obj_value
  ORDER BY wb_latest_vers.triple_order;

CREATE OR REPLACE VIEW wb_v_diffs AS 
 SELECT wb_vers_diffs.version, wb_vers_diffs.diff_type, 
    j_subject.string AS subject, j_predicate.string AS predicate, 
    j_object.string AS obj_value, wb_objects.obj_type, wb_objects.obj_lang, 
    wb_objects.obj_datatype, wb_vers_diffs.object_order
   FROM wb_vers_diffs
   JOIN wb_objects ON wb_objects.id_object = wb_vers_diffs.object
   JOIN wb_strings j_subject ON j_subject.id_string = wb_vers_diffs.subject
   JOIN wb_strings j_predicate ON j_predicate.id_string = wb_vers_diffs.predicate
   JOIN wb_strings j_object ON j_object.id_string = wb_objects.obj_value
  ORDER BY wb_vers_diffs.version, wb_vers_diffs.diff_type, j_subject.string, j_predicate.string, wb_vers_diffs.object_order, j_object.string, wb_objects.obj_type, wb_objects.obj_lang, wb_objects.obj_datatype;


