CREATE OR REPLACE FUNCTION wb_add_triple_to_version(input_version integer, input_user_id integer, input_subject text, input_predicate text, input_object_value text, input_object_type object_type, input_object_language character varying, input_object_datatype character varying, input_triple_order integer)
  RETURNS boolean AS
$BODY$DECLARE
    triple_result integer;
BEGIN
    SELECT * INTO triple_result FROM wb_get_triple_id(input_subject, input_predicate, input_object_value, input_object_type, input_object_language, input_object_datatype);

    INSERT INTO wb_triple_vers (version, triple, triple_order, change_timestamp, change_user) VALUES (input_version, triple_result, input_triple_order, CURRENT_TIMESTAMP, input_user_id);
    RETURN true;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


CREATE OR REPLACE FUNCTION wb_get_object_id(input_obj_type object_type, input_obj_value text, input_obj_lang character varying, input_obj_datatype character varying)
  RETURNS integer AS
$BODY$DECLARE
    value_id integer;
    object_result integer;
BEGIN
    SELECT * INTO value_id FROM wb_get_string_id(input_obj_value);

    SELECT wb_objects.id_object INTO object_result FROM wb_objects WHERE (wb_objects.obj_type = input_obj_type AND wb_objects.obj_value = value_id AND wb_objects.obj_lang = input_obj_lang AND wb_objects.obj_datatype = input_obj_datatype);
    IF NOT FOUND THEN
        INSERT INTO wb_objects (obj_type, obj_value, obj_lang, obj_datatype) VALUES (input_obj_type, value_id, input_obj_lang, input_obj_datatype) RETURNING wb_objects.id_object INTO object_result;
    END IF;
    RETURN object_result;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


CREATE OR REPLACE FUNCTION wb_get_string_id(input_string text)
  RETURNS integer AS
$BODY$DECLARE
    string_result integer;
BEGIN
    SELECT wb_strings.id_string INTO string_result FROM wb_strings WHERE (wb_strings.string = input_string);
    IF NOT FOUND THEN
        INSERT INTO wb_strings (string) VALUES (input_string) RETURNING wb_strings.id_string INTO string_result;
    END IF;
    RETURN string_result;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


CREATE OR REPLACE FUNCTION wb_get_triple_id(input_subject text, input_predicate text, input_object_value text, input_object_type object_type, input_object_language character varying, input_object_datatype character varying)
  RETURNS integer AS
$BODY$DECLARE
    subject_value_id integer;
    predicate_value_id integer;
    object_result integer;
    triple_result integer;
BEGIN
    SELECT * INTO subject_value_id FROM wb_get_string_id(input_subject);
    SELECT * INTO predicate_value_id FROM wb_get_string_id(input_predicate);
    SELECT * INTO object_result FROM wb_get_object_id(input_object_type, input_object_value, input_object_language, input_object_datatype);

    SELECT wb_triples.id_triple INTO triple_result FROM wb_triples WHERE
        (wb_triples.subject = subject_value_id AND
         wb_triples.predicate = predicate_value_id AND
         wb_triples.object = object_result);
    IF NOT FOUND THEN
        INSERT INTO wb_triples (subject, predicate, object) VALUES (subject_value_id, predicate_value_id, object_result) RETURNING wb_triples.id_triple INTO triple_result;
    END IF;
    RETURN triple_result;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;

