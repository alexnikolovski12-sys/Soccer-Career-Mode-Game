// Frozen copy of the 2025/26 squads (first real-player release), used only to map saves across.
// Real clubs and squads (2025/26 season, as far as known; ratings are rough
// estimates in the FC style, not official). Faces and hair are generated, not
// scanned. Format per player: "Name|POS|NATION|OVR|flags"
//   name:  "First Last"; an underscore joins a multi-word surname ("Virgil van_Dijk");
//          a single word is a mononym ("Pedri")
//   flags: d = darker skin, m = mid skin, L = left-footed, f = rapid, s = not quick
// Kits: primary, secondary, pattern, shorts, socks.

const W = '#f2f4f8', B = '#14161c';

export const REAL_CLUBS = {
  ENG: [
    ['Arsenal', 'ARS', ['#d6202b', W, 'sleeves', W, '#d6202b'], `
      David Raya|GK|ESP|87; Kepa Arrizabalaga|GK|ESP|80; William Saliba|CB|FRA|89|d; Gabriel Magalhães|CB|BRA|88|mL;
      Jurriën Timber|RB|NED|85|d; Ben White|RB|ENG|82; Riccardo Calafiori|LB|ITA|82|L; Piero Hincapié|LB|ECU|82|dL;
      Myles Lewis-Skelly|LB|ENG|77|dL; Cristhian Mosquera|CB|ESP|76|d; Declan Rice|CM|ENG|87; Martin Ødegaard|CAM|NOR|87|Ls;
      Martín Zubimendi|CDM|ESP|86; Mikel Merino|CM|ESP|83|Ls; Eberechi Eze|CAM|ENG|84|d; Ethan Nwaneri|CAM|ENG|76|dL;
      Bukayo Saka|RW|ENG|88|dL; Noni Madueke|RW|ENG|80|dLf; Gabriel Martinelli|LW|BRA|82|f; Leandro Trossard|LW|BEL|81;
      Viktor Gyökeres|ST|SWE|86; Kai Havertz|ST|GER|83|L`],
    ['Manchester City', 'MCI', ['#6cabdd', W, 'plain', W, '#6cabdd'], `
      Gianluigi Donnarumma|GK|ITA|89; James Trafford|GK|ENG|75; Rúben Dias|CB|POR|87; Joško Gvardiol|CB|CRO|86|L;
      John Stones|CB|ENG|82; Nathan Aké|CB|NED|80|dL; Rayan Aït-Nouri|LB|ALG|82|mL; Matheus Nunes|RB|POR|80|m;
      Rico Lewis|RB|ENG|78|d; Rodri|CDM|ESP|89|s; Nico González|CDM|ESP|79; Tijjani Reijnders|CM|NED|85|m;
      Bernardo Silva|CM|POR|85|Ls; Mateo Kovačić|CM|CRO|82|s; Phil Foden|CAM|ENG|85|L; Rayan Cherki|CAM|FRA|81|m;
      Jérémy Doku|LW|BEL|82|df; Savinho|RW|BRA|79|mL; Omar Marmoush|ST|EGY|83|m; Erling Haaland|ST|NOR|90|Lf`],
    ['Liverpool', 'LIV', ['#c8102e', W, 'plain', '#c8102e', '#c8102e'], `
      Alisson|GK|BRA|88; Giorgi Mamardashvili|GK|GEO|81; Virgil van_Dijk|CB|NED|89|d; Ibrahima Konaté|CB|FRA|85|d;
      Joe Gomez|CB|ENG|79|d; Jeremie Frimpong|RB|NED|83|df; Milos Kerkez|LB|HUN|81|L; Andrew Robertson|LB|SCO|82|L;
      Ryan Gravenberch|CDM|NED|85|d; Wataru Endo|CDM|JPN|78; Alexis Mac_Allister|CM|ARG|87; Dominik Szoboszlai|CM|HUN|85;
      Curtis Jones|CM|ENG|80|d; Florian Wirtz|CAM|GER|89; Mohamed Salah|RW|EGY|91|mLf; Federico Chiesa|RW|ITA|78;
      Cody Gakpo|LW|NED|85|m; Alexander Isak|ST|SWE|88|d; Hugo Ekitiké|ST|FRA|84|d`],
    ['Chelsea', 'CHE', ['#034694', W, 'plain', '#034694', W], `
      Robert Sánchez|GK|ESP|81; Filip Jørgensen|GK|DEN|75; Wesley Fofana|CB|FRA|80|d; Trevoh Chalobah|CB|ENG|79|d;
      Levi Colwill|CB|ENG|81|L; Benoît Badiashile|CB|FRA|77|dL; Marc Cucurella|LB|ESP|84|L; Reece James|RB|ENG|84|d;
      Malo Gusto|RB|FRA|80|d; Moisés Caicedo|CDM|ECU|88|d; Roméo Lavia|CDM|BEL|78|d; Enzo Fernández|CM|ARG|85;
      Andrey Santos|CM|BRA|76|m; Cole Palmer|CAM|ENG|87|L; Estêvão|RW|BRA|79|mL; Pedro Neto|LW|POR|82|Lf;
      Alejandro Garnacho|LW|ARG|80|f; João Pedro|ST|BRA|83|m; Liam Delap|ST|ENG|78`],
    ['Manchester United', 'MUN', ['#da291c', B, 'plain', W, B], `
      Senne Lammens|GK|BEL|77; Altay Bayındır|GK|TUR|72; Matthijs de_Ligt|CB|NED|82; Lisandro Martínez|CB|ARG|83|L;
      Harry Maguire|CB|ENG|78|s; Leny Yoro|CB|FRA|79|d; Luke Shaw|LB|ENG|79|L; Patrick Dorgu|LB|DEN|76|dLf;
      Diogo Dalot|RB|POR|80; Noussair Mazraoui|RB|MAR|80|m; Casemiro|CDM|BRA|81|ms; Manuel Ugarte|CDM|URU|79;
      Kobbie Mainoo|CM|ENG|80|d; Bruno Fernandes|CAM|POR|87; Mason Mount|CAM|ENG|78; Bryan Mbeumo|RW|CMR|84|dL;
      Amad Diallo|RW|CIV|80|dL; Matheus Cunha|CF|BRA|82|m; Benjamin Šeško|ST|SVN|81`],
    ['Tottenham Hotspur', 'TOT', [W, '#132257', 'plain', '#132257', W], `
      Guglielmo Vicario|GK|ITA|84; Antonín Kinský|GK|CZE|72; Cristian Romero|CB|ARG|85; Micky van_de_Ven|CB|NED|84|Lf;
      Kevin Danso|CB|AUT|78|d; Pedro Porro|RB|ESP|82; Destiny Udogie|LB|ITA|80|dL; Djed Spence|LB|ENG|77|d;
      João Palhinha|CDM|POR|82|s; Yves Bissouma|CDM|MLI|79|d; Pape Matar_Sarr|CM|SEN|80|d; Rodrigo Bentancur|CM|URU|80;
      James Maddison|CAM|ENG|81; Xavi Simons|CAM|NED|84|d; Mohammed Kudus|RW|GHA|83|dL; Dejan Kulusevski|RW|SWE|82|L;
      Brennan Johnson|RW|WAL|80|mf; Wilson Odobert|LW|FRA|74|d; Dominic Solanke|ST|ENG|80|d; Randal Kolo_Muani|ST|FRA|80|d;
      Richarlison|ST|BRA|79|d`],
    ['Newcastle United', 'NEW', [B, W, 'stripes', B, B], `
      Nick Pope|GK|ENG|82; Aaron Ramsdale|GK|ENG|78; Sven Botman|CB|NED|81|L; Fabian Schär|CB|SUI|80;
      Malick Thiaw|CB|GER|80|d; Dan Burn|CB|ENG|79|L; Kieran Trippier|RB|ENG|80; Tino Livramento|RB|ENG|80|d;
      Lewis Hall|LB|ENG|78|L; Bruno Guimarães|CDM|BRA|87|m; Sandro Tonali|CM|ITA|84; Joelinton|CM|BRA|82|ms;
      Joe Willock|CM|ENG|76|d; Anthony Gordon|LW|ENG|83|f; Harvey Barnes|LW|ENG|78; Anthony Elanga|RW|SWE|79|df;
      Jacob Murphy|RW|ENG|79|L; Nick Woltemade|ST|GER|81; Yoane Wissa|ST|COD|80|d`],
    ['Aston Villa', 'AVL', ['#7a1e3c', '#95bfe5', 'sleeves', W, '#7a1e3c'], `
      Emiliano Martínez|GK|ARG|86; Marco Bizot|GK|NED|77; Ezri Konsa|CB|ENG|82|d; Pau Torres|CB|ESP|80|L;
      Tyrone Mings|CB|ENG|79|dL; Lucas Digne|LB|FRA|80|L; Ian Maatsen|LB|NED|78|dL; Matty Cash|RB|POL|79;
      Boubacar Kamara|CDM|FRA|82|d; Amadou Onana|CDM|BEL|79|d; Youri Tielemans|CM|BEL|82|s; John McGinn|CM|SCO|81|L;
      Morgan Rogers|CAM|ENG|83|d; Emiliano Buendía|CAM|ARG|77; Leon Bailey|RW|JAM|78|dLf; Jadon Sancho|LW|ENG|77|d;
      Donyell Malen|ST|NED|80|mf; Evann Guessand|ST|CIV|77|d; Ollie Watkins|ST|ENG|83|d`],
  ],
  ESP: [
    ['Real Madrid', 'RMA', [W, '#d4af37', 'plain', W, W], `
      Thibaut Courtois|GK|BEL|89; Andriy Lunin|GK|UKR|79; Antonio Rüdiger|CB|GER|85|d; Éder Militão|CB|BRA|84|m;
      Dean Huijsen|CB|ESP|81|L; Raúl Asencio|CB|ESP|77; Trent Alexander-Arnold|RB|ENG|86; Dani Carvajal|RB|ESP|84;
      Álvaro Carreras|LB|ESP|81|L; Ferland Mendy|LB|FRA|81|dL; Aurélien Tchouaméni|CDM|FRA|86|d; Federico Valverde|CM|URU|89;
      Eduardo Camavinga|CM|FRA|84|dL; Dani Ceballos|CM|ESP|79; Jude Bellingham|CAM|ENG|90|d; Arda Güler|CAM|TUR|82|L;
      Brahim Díaz|CAM|MAR|80|m; Rodrygo|RW|BRA|85|d; Franco Mastantuono|RW|ARG|75|L; Vinícius_Jr.|LW|BRA|89|df;
      Kylian Mbappé|ST|FRA|91|df; Endrick|ST|BRA|77|dL`],
    ['FC Barcelona', 'BAR', ['#a50044', '#004d98', 'stripes', '#004d98', '#a50044'], `
      Joan García|GK|ESP|84; Marc-André ter_Stegen|GK|GER|85; Wojciech Szczęsny|GK|POL|81; Pau Cubarsí|CB|ESP|82;
      Ronald Araújo|CB|URU|83|d; Eric García|CB|ESP|80; Andreas Christensen|CB|DEN|79; Jules Koundé|RB|FRA|86|d;
      Alejandro Balde|LB|ESP|82|dLf; Gerard Martín|LB|ESP|74|L; Marc Casadó|CDM|ESP|77|s; Pedri|CM|ESP|89;
      Frenkie de_Jong|CM|NED|86; Gavi|CM|ESP|82; Fermín López|CAM|ESP|80; Dani Olmo|CAM|ESP|84;
      Lamine Yamal|RW|ESP|89|mL; Raphinha|LW|BRA|89|mL; Marcus Rashford|LW|ENG|81|df; Ferran Torres|ST|ESP|81;
      Robert Lewandowski|ST|POL|87|s`],
    ['Atlético de Madrid', 'ATM', ['#cb3524', W, 'stripes', '#1c2c5b', '#cb3524'], `
      Jan Oblak|GK|SVN|87; Juan Musso|GK|ARG|77; José María Giménez|CB|URU|82; Robin Le_Normand|CB|ESP|81;
      Dávid Hancko|CB|SVK|81|L; Clément Lenglet|CB|FRA|79|L; Marcos Llorente|RB|ESP|83|f; Nahuel Molina|RB|ARG|81;
      Matteo Ruggeri|LB|ITA|78|L; Johnny Cardoso|CDM|USA|78|m; Koke|CM|ESP|82|s; Pablo Barrios|CM|ESP|81;
      Conor Gallagher|CM|ENG|81; Álex Baena|CAM|ESP|83|L; Thiago Almada|CAM|ARG|80; Giuliano Simeone|RW|ARG|79;
      Nicolás González|LW|ARG|80|L; Antoine Griezmann|CF|FRA|84|Ls; Julián Álvarez|ST|ARG|88; Alexander Sørloth|ST|NOR|82|s`],
    ['Athletic Club', 'ATH', ['#ee2523', W, 'stripes', B, B], `
      Unai Simón|GK|ESP|84; Julen Agirrezabala|GK|ESP|74; Aymeric Laporte|CB|ESP|82|L; Dani Vivian|CB|ESP|81;
      Aitor Paredes|CB|ESP|77; Yuri Berchiche|LB|ESP|78|L; Óscar de_Marcos|RB|ESP|78; Jesús Areso|RB|ESP|77;
      Mikel Vesga|CDM|ESP|77|Ls; Mikel Jauregizar|CM|ESP|79; Iñigo Ruiz_de_Galarreta|CM|ESP|78; Oihan Sancet|CAM|ESP|82;
      Nico Williams|LW|ESP|85|df; Robert Navarro|LW|ESP|76|L; Álex Berenguer|RW|ESP|79; Iñaki Williams|RW|GHA|82|df;
      Gorka Guruzeta|ST|ESP|79; Maroan Sannadi|ST|ESP|73|m`],
    ['Villarreal', 'VIL', ['#ffe114', '#005187', 'plain', '#ffe114', '#ffe114'], `
      Luiz Júnior|GK|BRA|80|m; Diego Conde|GK|ESP|75; Renato Veiga|CB|POR|79|L; Juan Foyth|CB|ARG|79;
      Rafa Marín|CB|ESP|77; Santiago Mouriño|RB|URU|78; Sergi Cardona|LB|ESP|77|L; Thomas Partey|CDM|GHA|80|ds;
      Pape Gueye|CDM|SEN|79|d; Dani Parejo|CM|ESP|80|s; Santi Comesaña|CM|ESP|78; Alberto Moleiro|CAM|ESP|80|L;
      Nicolas Pépé|RW|CIV|79|dL; Tajon Buchanan|LW|CAN|76|df; Ayoze Pérez|ST|ESP|80; Gerard Moreno|ST|ESP|80|Ls;
      Georges Mikautadze|ST|GEO|79; Tani Oluwaseyi|ST|CAN|74|d`],
    ['Real Sociedad', 'RSO', ['#0067b1', W, 'stripes', W, '#0067b1'], `
      Álex Remiro|GK|ESP|83; Unai Marrero|GK|ESP|72; Igor Zubeldia|CB|ESP|79; Duje Ćaleta-Car|CB|CRO|77;
      Jon Martín|CB|ESP|72; Jon Aramburu|RB|VEN|77; Sergio Gómez|LB|ESP|78|L; Javi López|LB|ESP|76|L;
      Jon Gorrotxategi|CDM|ESP|75; Brais Méndez|CM|ESP|80; Luka Sučić|CM|CRO|77|L; Beñat Turrientes|CM|ESP|77;
      Carlos Soler|CM|ESP|79; Takefusa Kubo|RW|JPN|81|L; Ander Barrenetxea|LW|ESP|79; Mikel Oyarzabal|ST|ESP|83|L;
      Orri Óskarsson|ST|ISL|74`],
  ],
  GER: [
    ['FC Bayern München', 'FCB', ['#dc052d', W, 'plain', '#dc052d', '#dc052d'], `
      Manuel Neuer|GK|GER|86; Jonas Urbig|GK|GER|75; Dayot Upamecano|CB|FRA|84|d; Jonathan Tah|CB|GER|85|d;
      Kim Min-jae|CB|KOR|84; Alphonso Davies|LB|CAN|83|dLf; Raphaël Guerreiro|LB|POR|80|L; Konrad Laimer|RB|AUT|81;
      Josip Stanišić|RB|CRO|79; Joshua Kimmich|CDM|GER|88|s; Aleksandar Pavlović|CDM|GER|82; Leon Goretzka|CM|GER|82|s;
      Jamal Musiala|CAM|GER|88|m; Michael Olise|RW|FRA|88|dL; Serge Gnabry|RW|GER|82|m; Luis Díaz|LW|COL|86|mf;
      Nicolas Jackson|ST|SEN|81|d; Harry Kane|ST|ENG|90|s`],
    ['Borussia Dortmund', 'BVB', ['#fde100', B, 'plain', B, '#fde100'], `
      Gregor Kobel|GK|SUI|86; Alexander Meyer|GK|GER|72; Nico Schlotterbeck|CB|GER|83|L; Waldemar Anton|CB|GER|81;
      Niklas Süle|CB|GER|79; Ramy Bensebaini|LB|ALG|78|mL; Daniel Svensson|LB|SWE|77|L; Julian Ryerson|RB|NOR|79;
      Yan Couto|RB|BRA|77|m; Pascal Groß|CDM|GER|80|s; Felix Nmecha|CM|GER|81|d; Marcel Sabitzer|CM|AUT|80;
      Jobe Bellingham|CM|ENG|76|d; Julian Brandt|CAM|GER|81; Carney Chukwuemeka|CAM|AUT|76|d; Karim Adeyemi|LW|GER|80|df;
      Maximilian Beier|ST|GER|79; Serhou Guirassy|ST|GUI|86|d`],
    ['Bayer 04 Leverkusen', 'B04', ['#e32221', B, 'plain', B, '#e32221'], `
      Mark Flekken|GK|NED|80; Janis Blaswich|GK|GER|72; Edmond Tapsoba|CB|BFA|82|d; Loïc Badé|CB|FRA|79|d;
      Jarell Quansah|CB|ENG|78|d; Alejandro Grimaldo|LB|ESP|84|L; Arthur|RB|BRA|76|m; Robert Andrich|CDM|GER|80|s;
      Aleix García|CM|ESP|80|s; Exequiel Palacios|CM|ARG|82; Ibrahim Maza|CAM|ALG|76|m; Malik Tillman|CAM|USA|78|d;
      Claudio Echeverri|CAM|ARG|77|L; Ernest Poku|RW|NED|77|df; Martin Terrier|LW|FRA|79; Patrik Schick|ST|CZE|82|Ls;
      Christian Kofane|ST|CMR|72|d`],
    ['RB Leipzig', 'RBL', [W, '#dd0741', 'plain', W, W], `
      Péter Gulácsi|GK|HUN|80; Maarten Vandevoordt|GK|BEL|75; Willi Orbán|CB|HUN|80; Castello Lukeba|CB|FRA|81|dL;
      El Chadaille Bitshiabu|CB|FRA|74|d; David Raum|LB|GER|81|L; Lutsharel Geertruida|RB|NED|78|d; Ridle Baku|RB|GER|77|d;
      Nicolas Seiwald|CDM|AUT|79; Xaver Schlager|CM|AUT|80; Assan Ouédraogo|CM|GER|75|d; Christoph Baumgartner|CAM|AUT|81;
      Antonio Nusa|LW|NOR|77|df; Johan Bakayoko|RW|BEL|77|dL; Yan Diomande|RW|CIV|75|d; Conrad Harder|ST|DEN|75|L;
      Rômulo|ST|BRA|72|m`],
    ['Eintracht Frankfurt', 'SGE', [B, '#e1000f', 'plain', B, B], `
      Kauã Santos|GK|BRA|77|m; Michael Zetterer|GK|GER|74; Robin Koch|CB|GER|79; Arthur Theate|CB|BEL|79|L;
      Nnamdi Collins|CB|GER|74|d; Nathaniel Brown|LB|GER|79|dL; Rasmus Kristensen|RB|DEN|77; Ellyes Skhiri|CDM|TUN|78|m;
      Hugo Larsson|CM|SWE|79; Mario Götze|CAM|GER|78|s; Can Uzun|CAM|TUR|78; Farès Chaïbi|CAM|ALG|78|m;
      Ritsu Dōan|RW|JPN|79|L; Ansgar Knauff|RW|GER|77|f; Jean-Mattéo Bahoya|LW|FRA|74|d; Jonathan Burkardt|ST|GER|80;
      Elye Wahi|ST|FRA|77|d`],
  ],
  ITA: [
    ['Inter', 'INT', ['#0068a8', B, 'stripes', B, B], `
      Yann Sommer|GK|SUI|85; Josep Martínez|GK|ESP|76; Alessandro Bastoni|CB|ITA|87|L; Francesco Acerbi|CB|ITA|83|Ls;
      Manuel Akanji|CB|SUI|84|d; Stefan de_Vrij|CB|NED|81|s; Yann Bisseck|CB|GER|80|d; Denzel Dumfries|RB|NED|84|d;
      Federico Dimarco|LB|ITA|85|L; Hakan Çalhanoğlu|CDM|TUR|86|s; Nicolò Barella|CM|ITA|87; Henrikh Mkhitaryan|CM|ARM|82|s;
      Davide Frattesi|CM|ITA|81; Piotr Zieliński|CM|POL|80; Petar Sučić|CM|CRO|76; Luis Henrique|RW|BRA|77|mL;
      Lautaro Martínez|ST|ARG|88; Marcus Thuram|ST|FRA|85|d; Ange-Yoan Bonny|ST|FRA|77|d; Francesco Pio_Esposito|ST|ITA|72`],
    ['AC Milan', 'MIL', ['#e2231a', B, 'stripes', W, B], `
      Mike Maignan|GK|FRA|87|d; Pietro Terracciano|GK|ITA|72; Fikayo Tomori|CB|ENG|80|df; Matteo Gabbia|CB|ITA|79;
      Strahinja Pavlović|CB|SRB|78|L; Koni De_Winter|CB|BEL|77|d; Pervis Estupiñán|LB|ECU|79|dL; Alexis Saelemaekers|RW|BEL|80; Zachary Athekame|RB|SUI|74|d;
      Samuele Ricci|CDM|ITA|79; Luka Modrić|CM|CRO|85|s; Adrien Rabiot|CM|FRA|82|L; Youssouf Fofana|CM|FRA|81|d;
      Ruben Loftus-Cheek|CM|ENG|79|d; Christian Pulisic|RW|USA|84; Rafael Leão|LW|POR|85|df; Christopher Nkunku|ST|FRA|81|d;
      Santiago Giménez|ST|MEX|79`],
    ['Juventus', 'JUV', [W, B, 'stripes', B, W], `
      Michele Di_Gregorio|GK|ITA|82; Mattia Perin|GK|ITA|78; Bremer|CB|BRA|85|m; Federico Gatti|CB|ITA|80;
      Pierre Kalulu|RB|FRA|81|d; Lloyd Kelly|CB|ENG|77|L; Andrea Cambiaso|LB|ITA|83; Juan Cabal|LB|COL|75|dL;
      Manuel Locatelli|CDM|ITA|82|s; Khéphren Thuram|CM|FRA|81|d; Teun Koopmeiners|CM|NED|82|L; Weston McKennie|CM|USA|80;
      Kenan Yıldız|LW|TUR|85; Francisco Conceição|RW|POR|81|L; Edon Zhegrova|RW|KOS|79|L; Jonathan David|ST|CAN|83|d;
      Dušan Vlahović|ST|SRB|82|Ls; Loïs Openda|ST|BEL|81|df`],
    ['Napoli', 'NAP', ['#12a0d7', W, 'plain', W, '#12a0d7'], `
      Alex Meret|GK|ITA|80|L; Vanja Milinković-Savić|GK|SRB|80; Alessandro Buongiorno|CB|ITA|83|L; Amir Rrahmani|CB|KOS|82;
      Sam Beukema|CB|NED|79|L; Giovanni Di_Lorenzo|RB|ITA|84; Mathías Olivera|LB|URU|80|L; Leonardo Spinazzola|LB|ITA|77;
      Stanislav Lobotka|CDM|SVK|84|s; Frank Anguissa|CM|CMR|83|d; Scott McTominay|CM|SCO|86|s; Billy Gilmour|CM|SCO|79;
      Kevin De_Bruyne|CAM|BEL|87|s; Matteo Politano|RW|ITA|80|L; David Neres|LW|BRA|80|mL; Noa Lang|LW|NED|80|d;
      Rasmus Højlund|ST|DEN|80|L; Romelu Lukaku|ST|BEL|82|dLs`],
    ['Atalanta', 'ATA', ['#1e71b8', B, 'stripes', B, B], `
      Marco Carnesecchi|GK|ITA|83; Marco Sportiello|GK|ITA|72; Berat Djimsiti|CB|ALB|80; Isak Hien|CB|SWE|79|d;
      Odilon Kossounou|CB|CIV|78|d; Sead Kolašinac|CB|BIH|77|L; Raoul Bellanova|RB|ITA|78|df; Davide Zappacosta|RB|ITA|77;
      Nicola Zalewski|LB|POL|76|L; Marten de_Roon|CDM|NED|80|s; Éderson|CM|BRA|83|m; Mario Pašalić|CM|CRO|79|s;
      Charles De_Ketelaere|CAM|BEL|84|L; Lazar Samardžić|CAM|SRB|76|L; Daniel Maldini|CAM|ITA|76; Ademola Lookman|LW|NGA|84|d;
      Kamaldeen Sulemana|LW|GHA|76|df; Nikola Krstović|ST|MNE|79; Gianluca Scamacca|ST|ITA|79|s`],
    ['AS Roma', 'ROM', ['#8e1f2f', '#f0bc42', 'plain', '#8e1f2f', '#8e1f2f'], `
      Mile Svilar|GK|SRB|84; Pierluigi Gollini|GK|ITA|72; Gianluca Mancini|CB|ITA|82; Evan Ndicka|CB|CIV|81|dL;
      Mario Hermoso|CB|ESP|79|L; Zeki Çelik|RB|TUR|77; Wesley|RB|BRA|78|m; Angeliño|LB|ESP|80|L;
      Bryan Cristante|CDM|ITA|79|s; Manu Koné|CM|FRA|81|d; Neil El_Aynaoui|CM|MAR|77|m; Lorenzo Pellegrini|CAM|ITA|80;
      Tommaso Baldanzi|CAM|ITA|76|L; Matías Soulé|RW|ARG|80|L; Stephan El_Shaarawy|LW|ITA|77|m; Paulo Dybala|CF|ARG|83|Ls;
      Artem Dovbyk|ST|UKR|80|L; Evan Ferguson|ST|IRL|77`],
  ],
  FRA: [
    ['Paris Saint-Germain', 'PSG', ['#004170', '#da291c', 'centre', '#004170', '#004170'], `
      Lucas Chevalier|GK|FRA|82; Matvey Safonov|GK|RUS|76; Marquinhos|CB|BRA|86|m; Willian Pacho|CB|ECU|84|dL;
      Lucas Beraldo|CB|BRA|78|L; Achraf Hakimi|RB|MAR|89|mf; Nuno Mendes|LB|POR|87|dLf; Lucas Hernández|LB|FRA|82|L;
      Vitinha|CM|POR|89; João Neves|CM|POR|86; Fabián Ruiz|CM|ESP|84|Ls; Warren Zaïre-Emery|CM|FRA|81|d;
      Senny Mayulu|CM|FRA|74|d; Lee Kang-in|CAM|KOR|80|L; Ousmane Dembélé|RW|FRA|90|df; Désiré Doué|RW|FRA|85|d;
      Khvicha Kvaratskhelia|LW|GEO|87; Bradley Barcola|LW|FRA|83|df; Gonçalo Ramos|ST|POR|81`],
    ['Olympique de Marseille', 'OM', [W, '#2faee0', 'plain', W, W], `
      Gerónimo Rulli|GK|ARG|82; Jeffrey de_Lange|GK|NED|72; Leonardo Balerdi|CB|ARG|82; Benjamin Pavard|CB|FRA|81;
      Nayef Aguerd|CB|MAR|79|mL; Facundo Medina|LB|ARG|78|L; Amir Murillo|RB|PAN|76|d; Pierre-Emile Højbjerg|CDM|DEN|82|s;
      Matt O'Riley|CM|DEN|79|L; Arthur Vermeeren|CM|BEL|77; Bilal Nadir|CAM|MAR|78|m; Mason Greenwood|RW|ENG|84|dL;
      Timothy Weah|RW|USA|78|df; Amine Gouiri|LW|ALG|82|m; Igor Paixão|LW|BRA|78|mL; Pierre-Emerick Aubameyang|ST|GAB|81|df`],
    ['AS Monaco', 'ASM', ['#e51b22', W, 'halves', W, '#e51b22'], `
      Philipp Köhn|GK|SUI|79; Lukáš Hrádecký|GK|FIN|80; Mohammed Salisu|CB|GHA|79|dL; Thilo Kehrer|CB|GER|77|m;
      Eric Dier|CB|ENG|78|s; Caio Henrique|LB|BRA|77|mL; Vanderson|RB|BRA|80|m; Jordan Teze|RB|NED|76|d;
      Denis Zakaria|CDM|SUI|82|d; Lamine Camara|CM|SEN|80|d; Paul Pogba|CM|FRA|80|d; Maghnes Akliouche|CAM|FRA|82|mL;
      Takumi Minamino|CAM|JPN|80; Eliesse Ben_Seghir|LW|MAR|79|mL; Ansu Fati|LW|ESP|76|d; Folarin Balogun|ST|USA|79|d;
      Mika Biereth|ST|DEN|78|L`],
  ],
  POR: [
    ['SL Benfica', 'SLB', ['#e30613', W, 'plain', W, '#e30613'], `
      Anatoliy Trubin|GK|UKR|83; Samuel Soares|GK|POR|72; Nicolás Otamendi|CB|ARG|81|s; António Silva|CB|POR|81;
      Tomás Araújo|CB|POR|79; Samuel Dahl|LB|SWE|77|L; Amar Dedić|RB|BIH|77; Fredrik Aursnes|CM|NOR|81|s;
      Richard Ríos|CM|COL|81|mL; Enzo Barrenechea|CDM|ARG|78; Georgiy Sudakov|CAM|UKR|80; Dodi Lukébakio|RW|BEL|79|dL;
      Gianluca Prestianni|RW|ARG|74|L; Andreas Schjelderup|LW|NOR|77; Vangelis Pavlidis|ST|GRE|81; Franjo Ivanović|ST|CRO|77`],
    ['FC Porto', 'FCP', ['#0a3d91', W, 'stripes', '#0a3d91', '#0a3d91'], `
      Diogo Costa|GK|POR|84; Cláudio Ramos|GK|POR|72; Jakub Kiwior|CB|POL|79|L; Jan Bednarek|CB|POL|78;
      Nehuén Pérez|CB|ARG|77; Martim Fernandes|RB|POR|77; Alberto Costa|RB|POR|75; Francisco Moura|LB|POR|76|L;
      Alan Varela|CDM|ARG|79; Victor Froholdt|CM|DEN|76; Gabri Veiga|CM|ESP|80; Rodrigo Mora|CAM|POR|77;
      Pepê|RW|BRA|78|m; William Gomes|RW|BRA|76|mL; Borja Sainz|LW|ESP|76|L; Samu Aghehowa|ST|ESP|82|d;
      Deniz Gül|ST|SWE|74`],
    ['Sporting CP', 'SCP', ['#008057', W, 'hoops', B, '#008057'], `
      Rui Silva|GK|POR|81; João Virgínia|GK|POR|71; Ousmane Diomande|CB|CIV|82|d; Gonçalo Inácio|CB|POR|82|L;
      Zeno Debast|CB|BEL|78; Eduardo Quaresma|RB|POR|77|m; Iván Fresneda|RB|ESP|75; Maxi Araújo|LB|URU|78|L;
      Morten Hjulmand|CDM|DEN|83; Hidemasa Morita|CM|JPN|79; Daniel Bragança|CM|POR|77|L; Pedro Gonçalves|CAM|POR|81;
      Francisco Trincão|RW|POR|81|L; Geovany Quenda|RW|POR|77|dLf; Luis Suárez|ST|COL|80|m; Fotis Ioannidis|ST|GRE|79`],
  ],
  NED: [
    ['PSV', 'PSV', ['#ed1c24', W, 'stripes', B, '#ed1c24'], `
      Matěj Kovář|GK|CZE|78; Niek Schiks|GK|NED|68; Ryan Flamingo|CB|NED|78|dL; Armando Obispo|CB|NED|78|d;
      Yarek Gasiorowski|CB|ESP|74|L; Sergiño Dest|RB|USA|78|d; Anass Salah-Eddine|LB|MAR|74|mL; Mauro Júnior|LB|BRA|77|m;
      Jerdy Schouten|CDM|NED|80|s; Joey Veerman|CM|NED|79|s; Guus Til|CAM|NED|79|s; Ismael Saibari|CAM|MAR|80|mL;
      Ivan Perišić|LW|CRO|79|L; Couhaib Driouech|RW|MAR|76|mL; Dennis Man|RW|ROU|78|L; Ricardo Pepi|ST|USA|77|m`],
    ['Ajax', 'AJA', [W, '#d2122e', 'centre', W, W], `
      Vítězslav Jaroš|GK|CZE|77; Remko Pasveer|GK|NED|74; Josip Šutalo|CB|CRO|78; Youri Baas|CB|NED|76|L;
      Anton Gaaei|RB|DEN|77|d; Owen Wijndal|LB|NED|74|L; Kenneth Taylor|CM|NED|78|L; Davy Klaassen|CM|NED|77|s;
      Youri Regeer|CM|NED|74; Jorthy Mokio|CDM|BEL|72|d; Oscar Gloukh|CAM|ISR|77; Steven Berghuis|RW|NED|77|Ls;
      Mika Godts|LW|BEL|77|Lf; Kasper Dolberg|ST|DEN|75|m; Wout Weghorst|ST|NED|77|s`],
    ['Feyenoord', 'FEY', [W, '#e3061b', 'halves', B, B], `
      Timon Wellenreuther|GK|GER|77; Justin Bijlow|GK|NED|77; Tsuyoshi Watanabe|CB|JPN|77; Gijs Smal|LB|NED|75|L;
      Thomas Beelen|CB|NED|74; Givairo Read|RB|NED|74|d; Jordan Bos|LB|AUS|74|L; Hwang In-beom|CM|KOR|79;
      Quinten Timber|CM|NED|78|d; Oussama Targhalline|CDM|MAR|74|m; Sem Steijn|CAM|NED|77; Anis Hadj_Moussa|RW|ALG|78|mL;
      Leo Sauer|LW|SVK|73; Gonçalo Borges|RW|POR|74|L; Ayase Ueda|ST|JPN|77`],
  ],
};

/** Parse one club's squad string into player records. */
export function parseSquad(str) {
  return str.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [name, pos, nation, ovr, flags = ''] = s.split('|');
    const words = name.trim().split(' ');
    let first = '', last;
    if (words.length === 1) last = words[0].replace(/_/g, ' ');
    else { last = words.pop().replace(/_/g, ' '); first = words.join(' '); }
    return { first, last, pos, nation, ovr: +ovr, dark: flags.includes('d'), mid: flags.includes('m'), left: flags.includes('L'), fast: flags.includes('f'), slow: flags.includes('s') };
  });
}
