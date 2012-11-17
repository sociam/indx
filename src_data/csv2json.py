import csv, json

personas = []
for num in [1,2,3,4,5,6,7,8]:
    personas.append("Persona{0}".format(num))

files = {"BankTransactions.csv": "BankTransaction", "CreditCardTransactions.csv": "CreditCardTransaction"}

objs = []
for persona in personas:
    for filename in files:
        record_type = files[filename]

        f = open("{0}/{1}".format(persona, filename), "rb") 
        strip_top_line = f.readline()
        header = None
        reader = csv.reader(f)
        for row in reader:
            if not header:
                header = row
            else:
                obj = {"user": [{"@value": persona}], "record_type": [{"@value": record_type}]}
                for n in range(len(header)):
                    field = header[n]
                    if field == "":
                        continue

                    value = row[n]
                    obj[field] = [{"@value": value}]
                objs.append(obj)

        f.close()

print json.dumps(objs, indent=2)


