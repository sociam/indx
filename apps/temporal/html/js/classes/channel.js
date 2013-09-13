function Channel(name, DataSource, element)
{
	this.dataSource = DataSource;
	this.name = name;
	this.element = element;
	this.color = tEngine.pickColor();
}


