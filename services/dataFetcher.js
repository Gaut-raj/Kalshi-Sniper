//Use code from
//Get NBA player data for hit rates
//Web scrape data from https://www.basketball-reference.com/leagues/NBA_2023_per_game.html
import axios from 'axios'; 
import cheerio from 'cheerio'; 
export async function fetchNBAPlayerData() {
    try {
        const response = await axios.get('https://www.basketball-reference.com/leagues/NBA_2025_per_game.html');
        const response2 = await axios.get('https://www.basketball-reference.com/leagues/NBA_2026_per_game.html');
        const html = response.data;
        const $ = cheerio.load(html);
        const playerData = [];
        $('#per_game_stats tbody tr').each((index, element) => {
            const playerName = $(element).find('td[data-stat="player"] a').text();
            const team = $(element).find('td[data-stat="team_id"] a').text();
            const pointsPerGame = parseFloat($(element).find('td[data-stat="pts_per_g"]').text());
            const reboundsPerGame = parseFloat($(element).find('td[data-stat="trb_per_g"]').text());
            const assistsPerGame = parseFloat($(element).find('td[data-stat="ast_per_g"]').text());
            const 3ptmadePerGame = parseFloat($(element).find('td[data-stat="fg3m_per_g"]').text());
            if (playerName) {
                playerData.push({
                    playerName,
                    team,
                    pointsPerGame,
                    reboundsPerGame,
                    assistsPerGame,
                    3ptmadePerGame
                });
                
