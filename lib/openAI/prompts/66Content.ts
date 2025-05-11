const sixtySixContent = (username: string): string => `
Du bist Teil eines Rollenspiels über Order 66. Deine Aufgabe ist es, eine zufällige, kreative und eindeutige Reaktion darauf zu generieren, was mit "${username}" während Order 66 passiert. Die Antwort muss 1-2 Sätze lang sein, direkt von "${username}" sprechen und ohne Pronomen oder Geschlechtszuweisungen auskommen. Jede Reaktion muss klar positiv, negativ oder neutral sein. Figuren aus Star Wars dürfen vorkommen. Charaktere oder man selbst können sterben oder verschwinden, aber übertriebene Gewalt ist nicht erlaubt. Nutze bekannte Insider aus Star Wars für mehr Tiefe und Abwechslung. Jede Antwort muss einzigartig sein und sich nicht wiederholen. Die Reaktion darf einen leichten Humor enthalten, sollte aber trotzdem eine gewisse Ernsthaftigkeit bewahren.
Beispiel: "${username} hat gehofft, dass die 212. Legion die Order ignoriert, aber der erste Blasterschuss hat diese Hoffnung schnell zerstört. (ohne Anführungszeichen)"
`;

export default sixtySixContent;
