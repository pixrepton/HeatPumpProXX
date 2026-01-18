WAŻNE: DOKUMENTACJA TA DOTYCZY REZERWOWEGO SILNIKA – FALLBACK OZC-ENGINE
Żądanie
Treść żądania, na podstawie danych zebranych w formularzu, należy przesłać jako application/json.
Wszystkie parametry są obowiązkowe – poza opisanymi jako „warunkowe” lub „opcjonalne”.
Poniższy przykład dla ilustracji zawiera wszystkie parametry, także te, które w tym typie budynku nie są potrzebne.
{
        "building_type": "single_house",
        "construction_year": 2020,
        "construction_type": "traditional",
        "latitude": 51.4453433,
        "longitude": 16.2334445,
        "building_length": 12.5,
        "building_width": 6,
        "floor_area": 45,
        "floor_perimeter": 125,
        "building_floors": 3,
        "building_heated_floors": [0, 1, 2],
        "floor_height": 2.6,
        "building_roof": "steep",
        "has_basement": true,
        "has_balcony": true,
        "has_garage": false,
        "garage_type": "double_unheated",
        "wall_size": 65,
        "primary_wall_material": 57,
        "secondary_wall_material": null,
        "internal_wall_isolation": {
                "material": 88,
                "size": 5
        },
        "external_wall_isolation": {
                "material": 88,
                "size": 15
        },
        "top_isolation": {
                "material": 68,
                "size": 35
        },
        "bottom_isolation": {
                "material": 71,
                "size": 5
        },
        "number_doors": 2,
        "number_balcony_doors": 2,
        "number_windows": 12,
        "number_huge_windows": 0,
        "doors_type": "new_metal",
        "windows_type": "new_double_glass",
        "indoor_temperature": 21,
        "ventilation_type": "natural",
        "include_hot_water": true,
        "hot_water_persons": 3,
        "hot_water_usage": "shower_bath",
        "whats_over": "heated_room",
        "whats_under": "heated_room",
        "whats_north": "heated_room",
        "whats_south": "unheated_room",
        "whats_east": "heated_room",
        "whats_west": "outdoor",
        "on_corner": true,
        "unheated_space_under_type": "worst",
        "unheated_space_over_type": "great"
}




Parametr	Typ danych	Jednostka	Opis
building_type	enum	-	Rodzaj budynku:
    • single_house – Dom jednorodzinny wolnostojący
    • double_house – Zabudowa bliźniacza
    • row_house – Dom w zabudowie szeregowej
    • apartment – Mieszkanie
    • multifamily – Budynek wielorodzinny
construction_year	integer	-	Rok budowy; wartość nie musi być dokładna, wystarczy zdefiniować przedziały, podobnie jak to jest na cieplo.app:
    • 2025 – lata 2025+
    • 2021 – lata 2020 - 2024
    • 2011 – lata 2011 – 2020
    • 2000 – lata 2000 – 2010
    • 1990 – lata 90-te
    • 1980 – lata 80-te
    • 1970 – lata 70-te
    • 1960 – lata 60-te
    • 1950 – lata 50-te
    • 1940 – lata 40-te
    • 1939 – gdzieś przed II wojną
    • 1914 – gdzieś przed I wojną
construction_type	enum	-	Rodzaj konstrukcji budynku:
    • traditional – budynek tradycyjny, murowany lub z drewna
    • canadian – dom szkieletowy (kanadyjski)
latitude, longitude	double	-	Współrzędne przybliżonej lokalizacji budynku.
building_length, building_width 
warunkowe	double	m	Długość i szerokość obrysu budynku. Alternatywnie można podać powierzchnię zabudowy.
building_shape 
warunkoweopcjonalne	enum	-	Kształt obrysu ścian zewnętrznych budynku.
    • regular – z grubsza czworoboczny
    • irregular – każdy inny bardziej fikuśny kształt
Jeżeli obrys budynku jest mniej więcej regularnie czworoboczny – wystarczy, że prześlesz building_length + building_width albo floor_area. Wtedy niniejszy parametr (building_shape) można zupełnie pominąć lub przesłać regular.

Natomiast jeśli budynek ma kształt nieregularny, masz dwie opcje:
    • Liczysz pow. zabudowy po swojej stronie, wedle własnego pomysłu – i wysyłasz ją do API jako floor_area. Wtedy building_shape może być  regular, bo liczenie pow. zabudowy z nieregularnego kształtu jest obsłużone po swojej stronie.
    • Korzystasz z naszej logiki szacującej pow. zabudowy budynku o nieregularnym obrysie. Wtedy trzeba przesłać wartość irregular wraz z floor_area oraz floor_perimeter.
floor_area 
warunkowe	double	m2	Powierzchnia zabudowy. Alternatywnie można podać długość i szerokość obrysu budynku.
floor_perimeter 
warunkoweopcjonalne	double	m	Obwód budynku. Podaj tylko gdy building_shape = irregular.
building_floors




	integer	-	Liczba pełnych kondygnacji naziemnych – nie licząc poddasza i piwnic.
Maksymalna wartość: 13
building_heated_floors	array[integer]	-	Lista ogrzewanych kondygnacji, tutaj dla odmiany licząc piwnicę i poddasze:
    • 0 – piwnica
    • 1 – parter
    • 2 – 1. piętro
    • ...
    • 13 – 12. piętro
    • 14 – poddasze w 12-piętrowym budynku z nie-płaskim dachem
floor_height	enum/double	m	Wysokość pięter przeważająca w budynku.
    • 2.3 – niskie
    • 2.6 – standardowe
    • 3.1 – wysokie
    • 4.1 – b. wysokie
building_roof	enum	-	Rodzaj dachu
    • flat – płaski
    • oblique – skośny bez poddasza (lub poddasze niewielkie gdzie nie mieści się człowiek)
    • steep – skośny z pełnowymiarowym poddaszem
has_basement	boolean	-	Czy budynek posiada piwnicę?
has_balcony	boolean	-	Czy budynek posiada balkon(y)?
has_garage
opcjonalne	boolean	-	Czy jest garaż w bryle budynku? (garaż rozumiany jako jednostanowiskowy nieogrzewany) Parametr przestarzały, nadal działa, ale zalecane w zamian używanie parametru garage_type, który oferuje wybór wielkości i stopnia dogrzania garażu.
garage_type 
opcjonalne	enum	-	Charakterystyka garażu w bryle budynku.
    • none – Brak garażu w bryle budynku.
    • single_unheated – Garaż jednostanowiskowy nieogrzewany.
    • single_heated – Garaż jednostanowiskowy ogrzewany.
    • double_unheated – Garaż dwustanowiskowy nieogrzewany.
    • double_heated – Garaż dwustanowiskowy ogrzewany.
Parametr nadpisuje has_garage, jeśli oba zostały podane jednocześnie.
wall_size	integer	cm	Całkowita grubość ściany zewnętrznej.
primary_wall_material 
warunkowe
Wymagane tylko dla construction_type = traditional	Materiał	-	Podstawowy materiał konstrukcyjny ścian (ten, który przeważa).
secondary_wall_material
opcjonalne	Materiał	-	Dodatkowy materiał konstrukcyjny ścian (jeśli ściana jest zbudowana np. z mixu pustaków i cegieł).
internal_wall_isolation[material] 
warunkowe
Wymagane przy construction_type = canadian	Materiał	-	Materiał wewnętrznej warstwy izolacji w ścianie zewnętrznej.
internal_wall_isolation[size] 
warunkowe
Wymagane przy construction_type = canadian	integer	cm	Grubość wewnętrznej warstwy izolacji w ścianie zewnętrznej.
external_wall_isolation[material] 
opcjonalne
	Materiał	-	Materiał zewnętrznego docieplenia ścian zewnętrznych.
external_wall_isolation[size] 
opcjonalne	integer	cm	Grubość zewnętrznego docieplenia ścian zewnętrznych.
top_isolation[material] 
opcjonalne


	Materiał	-	Materiał ew. docieplenia przestrzeni ogrzewanej od góry. Może to być strop najwyższego ogrzewanego pomieszczenia lub dach – zależnie od konstrukcji budynku oraz od tego, które piętra są ogrzewane, a które nie.
top_isolation[size] 
opcjonalne	integer	cm	Grubość w/w docieplenia (jeśli jest takowe).
bottom_isolation[material] 
opcjonalne	Materiał	-	Materiał ew. docieplenia przestrzeni ogrzewanej od dołu. Może to być podłoga piwnicy, podłoga parteru albo strop parteru – zależnie od tego, które piętra są ogrzewane, a które nie.
bottom_isolation[size] 
opcjonalne	integer	cm	Grubość w/w docieplenia (jeśli jest takowe).
number_doors	integer	-	Liczba drzwi zewnętrznych w budynku.
number_balcony_doors	integer	-	Liczba drzwi balkonowych w budynku.
number_windows	integer	-	Liczba okien w budynku. Typowe okno = ok. 130x150cm.
number_huge_windows	integer	-	Liczba dużych przeszkleń w budynku. Duże przeszklenie = np. 3x3m.
doors_type	enum	-	Rodzaj drzwi zewnętrznych.
    • old_wooden – stare drewniane
    • old_metal – stare metalowe
    • new_wooden – nowe drewniane
    • new_metal – nowe metalowe
    • new_pvc – nowe z tworzywa
windows_type	enum	-	Rodzaj okien.
'2021+ trójszybowe' => '2021_triple_glass', '2021+ dwuszybowe' => '2021_double_glass', '2011-2020 trójszybowe' => 'new_triple_glass', '2011-2020 dwuszybowe' => 'new_double_glass', 'starsze z szybami zespolonymi' => 'semi_new_double_glass', 'starsze z dwiema zwykłymi szybami' => 'old_double_glass', 'starsze z pojedynczą zwykłą szybą' => 'old_single_glass',
    • 2021_triple_glass – 2021+ trójszybowe
    • 2021_double_glass – 2021+ dwuszybowe
    • new_triple_glass – 2011-2020 trójszybowe
    • new_double_glass – 2011-2020 dwuszybowe
    • semi_new_double_glass – Starsze z szybami zespolonymi
    • old_double_glass – Starsze z min. dwiema zwykłymi szybami
    • old_single_glass – Starsze z pojedynczą zwykłą szybą
indoor_temperature	double	°C	Średnia dobowa temperatura w pomieszczeniach ogrzewanych zimą.
ventilation_type	enum	-	Rodzaj wentylacji
    • natural – Naturalna lub grawitacyjna
    • mechanical – Mechaniczna
    • mechanical_recovery – Mechaniczna z odzyskiem ciepła
include_hot_water	boolean	-	Czy wyliczamy dodatkową moc na potrzeby podgrzewania ciepłej wody użytkowej (CWU)?
hot_water_persons
warunkowe
Wymagane tylko dla include_hot_water = true




	integer	-	Liczba osób korzystających z ciepłej wody użytkowej (CWU).
hot_water_usage
warunkowe
Wymagane tylko dla include_hot_water = true	enum	-	Intensywność wykorzystania ciepłej wody użytkowej (CWU):
    • shower – Tylko prysznice
    • shower_bath – Głównie prysznice, czasem wanna
    • bath – Tylko wanna
whats_over 
warunkowe
Wymagane tylko dla building_type = apartment




	enum	-	Co znajduje się powyżej mieszkania?
    • heated_room – Ogrzewany lokal
    • unheated_room – Nieogrzewany lokal
    • outdoor – Świat zewnętrzny
whats_under 
warunkowe
Wymagane tylko dla building_type = apartment	enum	-	Co znajduje się poniżej mieszkania?
    • heated_room – Ogrzewany lokal
    • unheated_room – Nieogrzewany lokal
    • outdoor – Świat zewnętrzny
    • ground – Grunt
whats_north, whats_east, whats_south, whats_west 
warunkowe
Wymagane tylko dla building_type = apartment	enum	-	Co znajduje się w sąsiedztwie mieszkania – z każdej z czterech stron osobno?
    • heated_room – Ogrzewany lokal
    • unheated_room – Nieogrzewany lokal / korytarz / klatka schodowa
    • outdoor – Świat zewnętrzny
on_corner 
warunkowe
Wymagane tylko dla building_type = row_house	boolean	-	Czy segment w zabudowie szeregowej znajduje się na końcu/początku szeregu?
unheated_space_under_type 
opcjonalne	enum	-	Jakość zaizolowania przestrzeni nieogrzewanej znajdującej się poniżej ogrzewanej części budynku.
    • worst – Hula tam wiatr bo np. drzwi dziurawe / okno dla kota uchylone
    • poor – Wiatr nie hula ale ocieplenia brak
    • medium – Wiatr nie hula ale ocieplenie jest gorsze niż na reszcie domu
    • great – Ocieplenie jest podobne lub lepsze jak na ogrzewanej części domu
Pole jest brane pod uwagę tylko w przypadku gdy istnieje jakaś przestrzeń nieogrzewana poniżej części ogrzewanej (np. nieogrzewana piwnica). Jeżeli to pole nie zostanie przesłane w zapytaniu, standardowo przyjmowana jest wartość medium.















unheated_space_over_type 
opcjonalne	enum	-	Jakość zaizolowania przestrzeni nieogrzewanej znajdującej się powyżej ogrzewanej części budynku.
    • worst – Hula tam wiatr bo np. drzwi dziurawe / okno uchylone
    • poor – Wiatr nie hula ale ocieplenia stropu/dachu brak
    • medium – Wiatr nie hula ale ocieplenie jest wyraźnie słabsze niż na reszcie domu
    • great – Ocieplenie jest podobne lub lepsze jak na ogrzewanej części domu
Pole jest brane pod uwagę tylko w przypadku gdy istnieje jakaś przestrzeń nieogrzewana ponad częścią ogrzewaną (np. nieogrzewane poddasze). Jeżeli to pole nie zostanie przesłane w zapytaniu, standardowo przyjmowana jest wartość medium.
number_stairways 
opcjonalne tylko dla building_type = multifamily	integer	-	Liczba klatek schodowych w budynku.
number_elevators 
opcjonalne tylko dla building_type = multifamily	integer	-	Liczba wind w budynku.
Odpowiedź (wynik) – sukces
Jako „wynik”, w odpowiedzi zwracane są te podstawowe dane:
{
        "result": {
                "id": 12345,
                "total_area": 145,
                "heated_area": 145,
                "max_heating_power": 5.2,
                "avg_heating_power": 2.5,
                "bivalent_point_heating_power": 4.6,
                "hot_water_power": 0.5,
                "annual_energy_consumption": 12345,
                "annual_energy_consumption_factor": 123,
                "avg_daily_energy_consumption": 123,
                "heating_power_factor": 155,
                "design_outdoor_temperature": -20,
                "avg_outdoor_temperature": 1.24
        }
}
            
Parametr	Typ danych	Jednostka	Opis
total_area	double	m2	Całkowita powierzchnia budynku
heated_area	double	m2	Ogrzewana powierzchnia budynku
max_heating_power	double	kW	Maksymalna moc grzewcza na potrzeby wyłącznie ogrzewania budynku w najzimniejszym dniu zimy (dla projektowej temperatury zewnętrznej).
avg_heating_power	double	kW	Przeciętna moc grzewcza na potrzeby wyłącznie ogrzewania budynku przy średniej zimowej temperaturze zewnętrznej.
bivalent_point_heating_power	double	kW	Moc grzewcza w punkcie biwalentnym, tj. przy temperaturze zewnętrznej wyliczonej odpowiednio dla strefy klimatycznej, w której znajduje się budynek.
hot_water_power	double	kW	Dodatkowa moc grzewcza na potrzeby przygotowania ciepłej wody użytkowej (CWU).
annual_energy_consumption	integer	kWh	Całkowite roczne zużycie energii na potrzeby wyłącznie ogrzewania budynku (nie jest w to wliczone przygotowanie CWU).
annual_energy_consumption_factor	double	kWh/m2	Współczynnik zapotrzebowania na ciepło.
avg_daily_energy_consumption	integer	kWh	Średnie dobowe zużycie energii na potrzeby wyłącznie ogrzewania budynku (nie jest w to wliczone przygotowanie CWU).
heating_power_factor	double	W/m2	Współczynnik zapotrzebowania na moc grzewczą.
design_outdoor_temperature	integer	°C	Projektowa temperatura zewnętrzna w danej lokalizacji, dla której liczona jest maksymalna wymagana moc grzewcza na potrzeby wyłącznie ogrzewania budynku.
avg_outdoor_temperature	double	°C	Średnia temperatura zewnętrzna w ciągu sezonu grzewczego na podstawie danych klimatycznych.
Odpowiedź – błędy
{
        "errors": {
                "internal_wall_isolation": "Pole wymagane."
        }
}
            
Pobranie wyniku
GET https://cieplo.app/api/calculation/{id}
Odpowiedź
{
        "parameters": {
                ...
        },
        "result": {
                "id": 12345,
                "total_area": 145,
                "heated_area": 145,
                "max_heating_power": 5.2,
                "avg_heating_power": 2.5,
                "bivalent_point_heating_power": 4.6,
                "annual_energy_consumption": 12345,
                "annual_energy_consumption_factor": 123,
                "avg_daily_energy_consumption": 123,
                "heating_power_factor": 155,
                "design_outdoor_temperature": -20,
                "avg_outdoor_temperature": 1.24
        }
}
            


Pobranie wyniku – wersja rozszerzona
GET https://cieplo.app/api/calculation/{id}?extended=1
Dodatkowo zwracane są: dane z wykresu z kosztami energii/paliw, lista najbardziej opłacalnych modernizacji budynku oraz dane z wykresu dot. strat ciepła.


Odpowiedź
{
        "parameters": {
                ...
        },
        "result": {
                ...
        },
        "bivalent_points": {
                "parallel": [
                        {
                                "temperature": 5,
                                "power": 3983,
                                "percent": 67
                        },
                        ...
                        {
                                "temperature": 0,
                                "power": 5228,
                                "percent": 82
                        },
                        ...
                        {
                                "temperature": -11,
                                "power": 7967,
                                "percent": 99
                        }
                ],
                "alternative": [
                        {
                                "temperature": 5,
                                "power": 3983,
                                "percent": 22
                        },
                        ...
                        {
                                "temperature": 0,
                                "power": 5228,
                                "percent": 67
                        },
                        ...
                        {
                                "temperature": -14,
                                "power": 8714,
                                "percent": 99
                        }
                ]
        },
        "heating_costs": [
        {
                "label": "Kocioł na drewno bez podajnika",
                "detail": "Ecodesign, z buforem ciepła",
                "fuel": {
                        "name": "Drewno",
                        "price": 1,
                        "unit": "kg",
                        "trade_amount": 450,
                        "trade_unit": "mp",
                        "energy": 16.00
                },
                "amount": 10651,
                "consumption": 23.7,
                "efficiency": 80,
                "cost": 9586
        },
        ...
        ],
        "improvements": [{
                "label": "ocieplenie dachu 20cm styropianu",
                "energy_saved": 35
        }, {
                "label": "wentylacja mechaniczna z odzyskiem ciepła",
                "energy_saved": 10
        }],
        "energy_losses": [{
                "label": "Drzwi",
                "percent": 2
        },{
                "label": "Ściany zewnętrzne",
                "percent": 3
        },{
                "label": "Podłoga parteru",
                "percent": 8
        },{
                "label": "Okna",
                "percent": 10
        },{
                "label": "Wentylacja",
                "percent": 17
        },{
                "label": "Dach",
                "percent": 60
        }]
}
            
Parametr	Typ danych	Jednostka	Opis
bivalent_points	array	-	Lista punktów biwalentnych.
bivalent_points[temperature]	integer	°C	Temperatura punktu biwalentnego.
bivalent_points[power]	integer	W	Moc grzewcza wymagana w punkcie biwalentnym.
bivalent_points[percent]	integer	-	Udział ciepła generowanego przez sprężarkę pompy ciepła w pokryciu sezonowego zapotrzebowania budynku na ciepło do ogrzewania, jaki zostanie osiągnięty w przypadku doboru mocy pompy ciepła pod ten punkt biwalentny.
heating_costs	array	-	Lista wariantów ogrzewania budynku: różne kombinacje urządzeń grzewczych i źródeł energii.
heating_costs[fuel][unit]	string	-	Jednostka obliczeniowa nośnika energii (ta, dla której zwyczajowo podawana jest wartość energetyczna, np. dla węgla jest to kg).
heating_costs[fuel][price]	double	zł/j.obl.	Cena za jednostkę obliczeniową nośnika energii.
heating_costs[fuel][trade_unit]	string	-	Jednostka handlowa (w jakiej sprzedawany jest dany nośnik energii), np.:
    • mp – metr przestrzenny (drewno)
    • t - tona (węgiel)
    • l - litr (olej)
    • kWh - kilowatogodzina (prąd, gaz)
heating_costs[fuel][trade_amount]	double	-	Liczba jednostek obliczeniowych mieszczących się w jednostce handlowej danego źródła energii.
heating_costs[fuel][energy]	double	MJ/j.obl.	Ilość energii w jednostce obliczeniowej.
heating_costs[amount]	integer	kWh	Ilość energii jaką trzeba zakupić w danym jej nośniku na potrzeby ogrzania tego budynku. Im gorsza sprawność danego źródła ciepła, tym ta liczba będzie większa od zapotrzebowania budynku.
heating_costs[consumption]	double	j.handl.	Zapotrzebowanie na dany nośnik energii wyrażone w jego jednostce handlowej.
heating_costs[efficiency]	integer	%	Efektywność danego urządzenia grzewczego, np. 80% dla kotła, 350% dla pompy ciepła.
heating_costs[cost]	integer	zł	Roczny koszt ogrzewania w danym wariance (urządzenie grzewcze + nośnik energii).
improvements	array	-	Warianty modernizacji budynku najbardziej zmniejszające zapotrzebowanie na energię.
improvements[energy_saved]	integer	%	Oszczędność energii względem pierwotnego zapotrzebowania budynku.
energy_loses	array	-	Procentowe rozbicie strac ciepła na poszczególnie źródła.
energy_loses[label]	string	-	Nazwa źródła strat ciepła.
energy_loses[percent]	integer	%	Procent całkowitej straty ciepła budynku jaki przypada na to źródło.
