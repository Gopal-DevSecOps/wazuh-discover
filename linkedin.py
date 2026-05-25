import requests
from time import sleep
import math
import pandas as pd
from xpath_json import extract_value_json
import json
list_data = []
cookies = {
    'li_sugr': 'c4a0ff01-584a-4158-afaf-accbd408dfa1',
    'bcookie': '"v=2&79725e92-2ae6-4f7c-8633-792a35b3aa4d"',
    'bscookie': '"v=1&202312021108223cd9110b-ec75-42ed-8e05-66c95ea35503AQEuYJ6u9dYc5jYot-F2DEvHpenArIjk"',
    'liap': 'true',
    'timezone': 'Asia/Calcutta',
    'li_theme': 'light',
    'li_theme_set': 'app',
    'aam_uuid': '14722644799965947631939804390787267506',
    '_gcl_au': '1.1.2049445439.1706263080',
    'AnalyticsSyncHistory': 'AQLh13V8M1fLJgAAAY1FNCEQruloVG3k3ljhfRIh7gaf405yRhF46lFMY6nf-Au0SNGLwR0UG-rsjZ7hvGShoQ',
    '_guid': '8e78143d-c86d-4dda-9ff6-67ff3a390401',
    'lms_ads': 'AQFz4D7elUelEAAAAY1FNCI97NSFyYB15v8JWOyeOE7c_mXlVyyO1-TsbJfz01hFwcXxh7bO3P3uWKpQ6X7EsgtJjJAjZnBM',
    'lms_analytics': 'AQFz4D7elUelEAAAAY1FNCI97NSFyYB15v8JWOyeOE7c_mXlVyyO1-TsbJfz01hFwcXxh7bO3P3uWKpQ6X7EsgtJjJAjZnBM',
    'g_state': '{"i_l":0}',
    'li_at': 'AQEDAUru8SMEYn8TAAABjUW3KM4AAAGNacOszk0ACeqLgKwRw6GRFRFIjuwsJeVbmMbpRtPx2gAX5SdTZOFpc3FRO3UuCvbWS8bgslCVu_5JRrS5jaro7BMzk10QW4oWXNMTPyMuCq9AeTXVwQF-ipIX',
    'JSESSIONID': '"ajax:7887647753061588778"',
    '__ssid': '77baa510-033a-44a0-91e7-68bd44cb5bb0',
    'gpv_pn': 'www.linkedin.com%2Fpayments%2Fpurchase',
    's_tp': '1646',
    's_tslv': '1706271671621',
    'dfpfpt': 'fd4a1c52c18044ecb6ec844d76070bcc',
    's_ips': '1008.3999938964844',
    'lang': 'v=2&lang=en-us',
    'UserMatchHistory': 'AQJkLH8Vp4w0QgAAAY1GMSwS98mAzbXoyTAWdM21XS4qOjANlOsyQD52i5siQbDiIEw_B3hMwklYlVEk0_qnU8E2q-uFY8bMSrTS0DoISQuQEixuZfGb2OLPttmZ89CiS_dRRPxIMinENp5oCC9i-jtbeizvErrF6zuOPG9fu3geq3nvMBEZcz1aBM3CxHwBzmHdEuascf1Go0k4QwtQmelL6ar2z5bFsiiY3vfT9igtuEwubYwrPQ5M1WovDlDrBJOyycgAkx7Un_uXCY9_uODECz3p9C4zAGUeBa0rx20V5AMr1tHcc5NezlOTPK8oO2KvWlw',
    'AMCVS_14215E3D5995C57C0A495C55%40AdobeOrg': '1',
    'AMCV_14215E3D5995C57C0A495C55%40AdobeOrg': '-637568504%7CMCIDTS%7C19749%7CMCMID%7C14866535298271624961883840466620565625%7CMCAAMLH-1706884464%7C12%7CMCAAMB-1706884464%7CRKhpRz8krg2tLO6pguXWp5olkAcUniQYPHaMWWgdJ3xzPWQmdj0y%7CMCOPTOUT-1706286864s%7CNONE%7CvVersion%7C5.1.1%7CMCCIDH%7C-591632083',
    'lidc': '"b=VB83:s=V:r=V:a=V:p=V:g=3290:u=2:x=1:i=1706279649:t=1706358361:v=2:sig=AQFSAujmN0MVCyE_y0qZ2usgog7pqnPG"',
}

headers = {
    'authority': 'www.linkedin.com',
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'accept-language': 'en-US,en;q=0.9',
    # Requests sorts cookies= alphabetically
    # 'cookie': 'li_sugr=c4a0ff01-584a-4158-afaf-accbd408dfa1; bcookie="v=2&79725e92-2ae6-4f7c-8633-792a35b3aa4d"; bscookie="v=1&202312021108223cd9110b-ec75-42ed-8e05-66c95ea35503AQEuYJ6u9dYc5jYot-F2DEvHpenArIjk"; liap=true; timezone=Asia/Calcutta; li_theme=light; li_theme_set=app; aam_uuid=14722644799965947631939804390787267506; _gcl_au=1.1.2049445439.1706263080; AnalyticsSyncHistory=AQLh13V8M1fLJgAAAY1FNCEQruloVG3k3ljhfRIh7gaf405yRhF46lFMY6nf-Au0SNGLwR0UG-rsjZ7hvGShoQ; _guid=8e78143d-c86d-4dda-9ff6-67ff3a390401; lms_ads=AQFz4D7elUelEAAAAY1FNCI97NSFyYB15v8JWOyeOE7c_mXlVyyO1-TsbJfz01hFwcXxh7bO3P3uWKpQ6X7EsgtJjJAjZnBM; lms_analytics=AQFz4D7elUelEAAAAY1FNCI97NSFyYB15v8JWOyeOE7c_mXlVyyO1-TsbJfz01hFwcXxh7bO3P3uWKpQ6X7EsgtJjJAjZnBM; g_state={"i_l":0}; li_at=AQEDAUru8SMEYn8TAAABjUW3KM4AAAGNacOszk0ACeqLgKwRw6GRFRFIjuwsJeVbmMbpRtPx2gAX5SdTZOFpc3FRO3UuCvbWS8bgslCVu_5JRrS5jaro7BMzk10QW4oWXNMTPyMuCq9AeTXVwQF-ipIX; JSESSIONID="ajax:7887647753061588778"; __ssid=77baa510-033a-44a0-91e7-68bd44cb5bb0; gpv_pn=www.linkedin.com%2Fpayments%2Fpurchase; s_tp=1646; s_tslv=1706271671621; dfpfpt=fd4a1c52c18044ecb6ec844d76070bcc; s_ips=1008.3999938964844; lang=v=2&lang=en-us; UserMatchHistory=AQJkLH8Vp4w0QgAAAY1GMSwS98mAzbXoyTAWdM21XS4qOjANlOsyQD52i5siQbDiIEw_B3hMwklYlVEk0_qnU8E2q-uFY8bMSrTS0DoISQuQEixuZfGb2OLPttmZ89CiS_dRRPxIMinENp5oCC9i-jtbeizvErrF6zuOPG9fu3geq3nvMBEZcz1aBM3CxHwBzmHdEuascf1Go0k4QwtQmelL6ar2z5bFsiiY3vfT9igtuEwubYwrPQ5M1WovDlDrBJOyycgAkx7Un_uXCY9_uODECz3p9C4zAGUeBa0rx20V5AMr1tHcc5NezlOTPK8oO2KvWlw; AMCVS_14215E3D5995C57C0A495C55%40AdobeOrg=1; AMCV_14215E3D5995C57C0A495C55%40AdobeOrg=-637568504%7CMCIDTS%7C19749%7CMCMID%7C14866535298271624961883840466620565625%7CMCAAMLH-1706884464%7C12%7CMCAAMB-1706884464%7CRKhpRz8krg2tLO6pguXWp5olkAcUniQYPHaMWWgdJ3xzPWQmdj0y%7CMCOPTOUT-1706286864s%7CNONE%7CvVersion%7C5.1.1%7CMCCIDH%7C-591632083; lidc="b=VB83:s=V:r=V:a=V:p=V:g=3290:u=2:x=1:i=1706279649:t=1706358361:v=2:sig=AQFSAujmN0MVCyE_y0qZ2usgog7pqnPG"',
    'csrf-token': 'ajax:7887647753061588778',
    'referer': 'https://www.linkedin.com/search/results/people/?geoUrn=%5B%22102713980%22%5D&keywords=ciso&origin=FACETED_SEARCH&sid=0nS',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'x-li-lang': 'en_US',
    'x-li-page-instance': 'urn:li:page:d_flagship3_search_srp_people_load_more;I0A3NdSGTO6L485EIFwRBw==',
    'x-li-track': '{"clientVersion":"1.13.9792","mpVersion":"1.13.9792","osName":"web","timezoneOffset":5.5,"timezone":"Asia/Calcutta","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1.25,"displayWidth":1920,"displayHeight":1080}',
    'x-restli-protocol-version': '2.0.0',
}


def extract_value_json(json_data, json_path):
    try:
        value = extract_json_path(json_data, json_path)
    except (json.JSONDecodeError, KeyError):
        value = ''
    return value


def extract_json_path(data, json_path):
    try:
        keys = json_path.split('.')
        value = data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            elif isinstance(value, list):
                try:
                    index = int(key)
                    if 0 <= index < len(value):
                        value = value[index]
                    else:
                        value = ''
                except ValueError:
                    value = ''
            else:
                value = ''
                break
        if isinstance(value, (str, int, float)):
            value = str(value)
        else:
            value = ''
    except (KeyError, IndexError, TypeError):
        value = ''
    return value



def append_data(title, designation, location, url, email='', contact=''):
    list_data.append({
        'name': title,
        'designation': designation,
        'location': location,
        'url': url,
        'email': email,
        'contact': contact
    })


def send_request(hit_url):
    retry_count = 0
    max_retries = 7
    r = None
    while retry_count < max_retries:
        try:
            with requests.get(hit_url, cookies=cookies, headers=headers) as r:
                if r.status_code == 404:
                    return r
                r.raise_for_status()
            break
        except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
            retry_count += 1
            print(f"Request failed: {e}")
            if retry_count == max_retries:
                print("Max retries reached. Exiting...")
            else:
                print(f"Retrying ({retry_count}/{max_retries})...")
                sleep(3)
    return r


def get_info(url):
    id = url.split('/')[-1]    
    contact_url = f'https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:{id})&queryId=voyagerIdentityDashProfiles.6b9ac2e690a148fc00f53e808493deb6'
    res = send_request(contact_url)

    if res is None:
        return None
    if res.status_code != 200:
        return None

    try:
        js_data = json.loads(res.text)
    except:
        print('error')
        return None

    list_js = js_data['included']
    for y in list_js:
        pid = extract_value_json(y, 'publicIdentifier')
        if pid == id:
            email = extract_value_json(y, 'emailAddress.emailAddress')
            contact = extract_value_json(y, 'phoneNumbers[0].phoneNumber.number')
            return email, contact


def get_data(go_url):
    h_url = go_url
    page = 0
    while True:
        page += 1
        print(f'{page=}')
        res = send_request(go_url)
        if res.status_code != 200:
            continue

        try:
            js_data = json.loads(res.text)
        except:
            print('error')
            return None
        
        if page == 1:
            nop = math.ceil(int(extract_value_json(js_data, 'data.data.searchDashClustersByAll.paging.total'))/10)

        list_js = js_data['included']
        for y in list_js:
            title = extract_value_json(y, 'title.text')
            designation = extract_value_json(y, 'primarySubtitle.text')            
            location = extract_value_json(y, 'secondarySubtitle.text')
            url = extract_value_json(y, 'navigationUrl').split('?')[0]

            if (title or designation):

                if 'linkedin member' not in title.lower():
                    try:
                        email, contact = get_info(url)
                    except:
                        email = ''
                        contact = ''
                    append_data(title, designation, location, url, email, contact)
                # else:
                #     append_data(title, designation, location, url)          

        if page < nop:
            go_url = str(h_url).replace(f'start:0', f'start:{page*10}')

        else:
            break


url = "https://www.linkedin.com/voyager/api/graphql?variables=(start:0,origin:FACETED_SEARCH,query:(keywords:ciso,flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:geoUrn,value:List(102713980)),(key:resultType,value:List(PEOPLE))),includeFiltersInResponse:false))&queryId=voyagerSearchDashClusters.e1f36c1a2618e5bb527c57bf0c7ebe9f"

get_data(url)
df = pd.DataFrame(list_data)
df.to_excel('linkedin.xlsx', index=False, engine='openpyxl')